#!/usr/bin/env node
const lodash = require("loadsh");
const commander = require("commander");
const globby = require("globby");
const jscodeshift = require("jscodeshift");
const path = require("path");
const fs = require("fs");

/**
 * 调试方式：
 * vscode 调试选 Javascript Debug Terminal
 * 然后在下方终端中输入 node mycli transform projectdemo -r
 */
/**
 * 生成UKey
 * @param {*} eng
 * 五个单词内，首字母大写
 * 超过五个单词，后面加数字递增
 */
function buildUKey(eng, ukeys) {
  const ukey = eng
    .split(" ")
    .map((s) => s.replace(/\s/g, ""))
    .filter(Boolean)
    .splice(0, 5)
    .reduce((p, c) => {
      return c.length && c[0] ? p + c[0].toUpperCase() : p;
    }, "");
  const sameKeys = ukeys.filter((c) =>
    new RegExp("^" + ukey + "[0-9]{0,}$").test(c)
  );
  return ukey + (sameKeys.length || "");
}
/**
 * 是否加载之前的 i18nMapChinese.txt 文件
 * i18nast transform projectdemo
 * @returns
 */
function reloadOldI18nMap() {
  // 中文配置集合
  const i18nMapFile = globby.sync(
    path.resolve(process.cwd(), "./i18nMapChinese.txt").replace(/\\/g, "/")
  );
  const i18nMapEnglishFile = globby.sync(
    path.resolve(process.cwd(), "./i18nMapEnglish.txt").replace(/\\/g, "/")
  );
  if (i18nMapFile.length && i18nMapEnglishFile.length) {
    const oc = fs
      .readFileSync(i18nMapFile[0], {
        encoding: "utf-8",
      })
      .split("\n");
    const oceng = fs
      .readFileSync(i18nMapEnglishFile[0], {
        encoding: "utf-8",
      })
      .split("\n");
    if (oc.length != oceng.length) {
      throw "错误！！中英文配置文件行数不同";
    }
    const op = oc.reduce(
      (p, c, i) => {
        const k = buildUKey(oceng[i], p.ukeys);
        p.ukeys.push(k);
        p.object[c] = k;
        return p;
      },
      {
        object: {},
        ukeys: [],
      }
    );
    return op.object;
  } else {
    throw "错误！！中或者英文配置文件为空";
  }
}
/**
 * 加载指定目录下 所有 ts,tsx,js,jsx 文件
 * @param {*} fileOrfolder
 * @returns
 */
function getAllFiles(fileOrfolder) {
  const fullPath = path
    .resolve(process.cwd(), fileOrfolder)
    .replace(/\\/g, "/");
  const allFiles = globby
    .sync(`${fullPath}/**/!(*.d).{ts,tsx,js,jsx}`, {
      dot: true,
      ignore: [],
    })
    .map((x) => path.resolve(x));
  return allFiles;
}

/**
 * 执行 Ast
 * @param {*} fullpath
 * @param {*} i18nMap
 */
function transform(fullpath, i18nMap, i18nUkeyMap) {
  const content = fs.readFileSync(fullpath, { encoding: "utf-8" });
  const parser = fullpath.substr(fullpath.lastIndexOf(".") + 1);
  const j = jscodeshift.withParser(parser);
  const root = j(content);
  root
    .find(j.StringLiteral, (p) => /[\u4e00-\u9fa5]/.test(p.value))
    .forEach((path) => {
      // 中文
      const value = path.node.value;
      if (!i18nMap.includes(value)) {
        i18nMap.push(value);
      }
      // 替换
      if (i18nUkeyMap) {
        // Ukey
        const Ukey = i18nUkeyMap[value];
        const Intkey = Ukey;
        if (Ukey) {
          j(path).replaceWith((p) => {
            p.node.value = `intl.get('${Intkey}')`;
            return p.node.value;
          });
        }
      }
    });
  fs.writeFileSync(fullpath, root.toSource(), { encoding: "utf-8" });
}

/**
 * 替换 Ast
 */
function traverse(fullpath, i18nUkeyMap) {
  transform(fullpath, Object.keys(i18nUkeyMap || {}), i18nUkeyMap);
}

/**
 * 第一步，提取中文写入i18nMapChinese.txt
 * @param {*} i18nMap
 */
function writeToI18nMapJson(i18nMap) {
  fs.writeFileSync(
    path.resolve(process.cwd(), "./i18nMapChinese.txt"),
    i18nMap.join("\n"),
    "utf-8"
  );
}

/**
 * 命令 i18nast transform projectdemo
 * 会在安装包目录下生成 i18nMap.json 里面记录了指定目录下解析生成中文提取
 */
commander.command("transform <fileOrfolder>").action(async (fileOrfolder) => {
  Promise.resolve()
    .then(() => {
      return {
        allFiles: [],
        i18nMap: [],
      };
    })
    .then((res) => {
      res.allFiles = getAllFiles(fileOrfolder);
      return res;
    })
    .then((res) => {
      res.allFiles.forEach((fullpath) => transform(fullpath, res.i18nMap));
      return res;
    })
    .then((res) => {
      writeToI18nMapJson(res.i18nMap);
      return res;
    })
    .then(() => {
      fs.writeFileSync(
        path.resolve(process.cwd(), "./i18nMapEnglish.txt"),
        "将翻译内容替换到这里，只要英文，这一行中文也不要了，英文要和i18nMapChinese每行对应，如： \nHello\nMoney\nYellow",
        "utf-8"
      );
    });
});

/**
 * 命令 i18nast traverse projectdemo
 * 会在安装包目录下生成 i18nMap.json 里面记录了指定目录下解析生成中文提取
 */
commander.command("traverse <fileOrfolder>").action(async (fileOrfolder) => {
  Promise.resolve()
    .then(() => {
      const res = {
        i18nUkeyMap: reloadOldI18nMap(),
      };
      return res;
    })
    .then((res) => {
      res.allFiles = getAllFiles(fileOrfolder);
      return res;
    })
    .then((res) => {
      res.allFiles.forEach((fullpath) => traverse(fullpath, res.i18nUkeyMap));
    });
});
// 绑定解析
commander.parse(process.argv);
