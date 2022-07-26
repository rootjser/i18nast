import React from 'react';
import styles from './drawGift.scss';
import { helpers } from '@/utils';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { drawGiftAction } from '@/actions';
import Toast from '@/components/toast';
import { getToken } from '@/utils/token-tool';
import { isArray, isEmpty, forEach, get } from 'lodash';
import moment from 'dayjs';
import { Table, Pagination } from 'kui-web';
import WinnerList from './components/winnerList';
import GetAwardModal from '@/components/get-award-modal';
import classnames from 'classnames';
import getAwardModalStyles from '@/components/get-award-modal/index.scss';
import { RootState } from '@/reducers';

const rotateBgImg = window.tc.commonImg.drawGift.wheel;
const redGiftImg = window.tc.commonImg.drawGift.red_gift;
/** 播放icon */
const Play = () => {
  const sponsor_icon_play = window.tc.commonImg.icon_play;
  return <img className={styles.playBtn} src={sponsor_icon_play} alt="" />;
};

const initState = {
  tabIndex: 0,
  showPlay: true,
  rotateNum: 0,
  receiverInfo: {} as any,
  showRecordsTable: false,
  showSuccessModal: false,
  modalInfo: {
    isShow: false,
    modalType: '',
    awardList: [] as any,
    awardInfo: {} as any,
  },
  recordsTabType: 'detail',
  detailTabIndex: 0,
  statisticTabIndex: 0,
  reloadStatisticRecords: true,
};

type State = typeof initState;

const connector = connect((state: RootState) => ({
  drawGiftConfig: state.drawGiftReducer.drawGiftConfig,
  currPlayInfo: state.drawGiftReducer.currPlayInfo,
  winnerList: state.drawGiftReducer.winnerList,
  currWinnerList: state.drawGiftReducer.currWinnerList,
  recordsStatisticInfo: state.drawGiftReducer.recordsStatisticInfo,
  recordsDetailInfo: state.drawGiftReducer.recordsDetailInfo,
  userInfo: state.app.userInfo,
}));

type Props = ConnectedProps<typeof connector> &
  RouteComponentProps<{ id: string }>;
class DrawGift extends React.PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = initState;
    this.videoRef = React.createRef();
  }

  public activityId = this.props.match.params.activityId;

  public pageSize = 6;
  public timer1: any;
  public timer2: any;
  public videoRef: React.RefObject<HTMLVideoElement>;

  public componentDidMount() {
    // 获取活动配置信息
    this.handleDrawGiftConfigGet({ activityId: this.activityId }, (res) => {
      if (res && res.playList && res.playList[0].id) {
        this.handleDrawGiftWinnerListGet({
          activityId: this.activityId,
          playId: res.playList[0].id,
          tabIndex: this.state.tabIndex,
        });
        if (getToken()) {
          this.handleCurrPlayInfoGet({
            activityId: this.activityId,
            playId: res.playList[0].id,
          });
          this.handleReceiverInfoGet({
            activityId: this.activityId,
          });
        }
      }
    });
  }
  public componentWillUnmount() {
    this.props.dispatch({ type: drawGiftAction.DRAWGIFT_DATA_INIT_REDUCE });
    cancelAnimationFrame(this.timer1);
    cancelAnimationFrame(this.timer2);
  }

  // 开启loading
  public handleStartLoading = () => {
    this.props.dispatch({
      type: '@@ty/loadingShow',
    });
  };

  /**
   * 成功后奖获奖信息加入跑马灯
   * @param {object} awardList 抽中的奖品列表
   */
  public handleUpdateWinnerList = (awardList: any) => {
    const { tabIndex } = this.state;
    const { winnerList, currWinnerList } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    const name = get(this.props, 'userInfo.name');
    const list = winnerList[tabIndex];
    const currList = currWinnerList[tabIndex];
    // 成功后，如果原数据是数组，更新跑马灯数据
    if (isArray(list)) {
      // 筛选出礼金和实物奖
      const newAwardList = awardList.filter(
        (item) => item.giftType === 1 || item.giftType === 2,
      );
      if (newAwardList.length) {
        const _list = newAwardList.map((item) => {
          return {
            awardsContent:
              item.giftType === 1 ? item.giftAmount + intl.get('HM') : item.giftName,
            awardsName: item.awardsName,
            memberName: name.slice(0, 2) + '****' + name.slice(-2),
            self: true,
          };
        });
        let newList;
        if (list.length < 4) {
          newList = currList.concat(_list);
        } else {
          _list.unshift(4, 0);
          newList = [...list];
          const arr = [];
          arr.splice.apply(newList, _list);
        }
        // 先清空是为了重新渲染组件
        this.props.dispatch({
          type: drawGiftAction.DRAW_UPDATE_WINNER_LIST_REDUCE,
          payload: { data: [], tabIndex },
        });
        this.props.dispatch({
          type: drawGiftAction.DRAW_UPDATE_WINNER_LIST_REDUCE,
          payload: { data: newList, tabIndex },
        });
      }
    } else {
      // 成功后，如果原数据不是数组，重新请求新跑马灯数据
      this.handleDrawGiftWinnerListGet({
        activityId: this.activityId,
        playId: current.id,
        tabIndex,
      });
    }
  };

  /**
   * 活动配置获取
   * @param {number} activityId 活动ID
   * @func handleCallback? 获取成功回调
   */
  public handleDrawGiftConfigGet = (
    payload: { activityId: string },
    handleCallback?: (playId) => void,
  ) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_CONFIG_POST_EPIC,
      payload,
      handleCallback,
    });
  };

  /**
   * 获取用户当前玩法信息
   * @param {number} activityId 活动ID
   * @param {number} playId 玩法ID
   */
  public handleCurrPlayInfoGet = (payload: {
    activityId: string;
    playId: number;
  }) => {
    this.props.dispatch({
      type: drawGiftAction.CURRENT_PLAY_INFO_POST_EPIC,
      payload,
    });
  };

  /**
   * 中奖名单列表
   * @param {number} activityId 活动ID
   * @param {number} playId 玩法ID
   * @param {number} tabIndex 请求的tab
   */
  public handleDrawGiftWinnerListGet = (payload: {
    activityId: string;
    playId: number;
    tabIndex: number;
  }) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_WINNER_LIST_POST_EPIC,
      payload,
    });
  };

  /**
   * 
   * @param {number} activityId 活动ID
   * @param {number} playId 玩法ID
   * @param {number} drawNum 次数： 1次：1,10次：0
   * @param {function} handleCallback 回调response
   */
  public handleDrawPost = (
    payload: {
      activityId: string;
      playId: number;
      drawNum: number;
    },
    handleCallback: (response) => void,
  ) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_DRAW_POST_EPIC,
      payload,
      handleCallback,
    });
  };

  /**
   * 获取用户姓名电话地址
   */
  public handleReceiverInfoGet = (payload: { activityId: string }) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_USER_INFO_POST_EPIC,
      payload,
      handleCallback: (data) => {
        this.setState({ receiverInfo: { ...data } });
      },
    });
  };

  /**
   * 获奖记录明细列表
   * @param {number} activityId 活动ID
   * @param {number} playId 活动ID
   * @param {number} category 不传:全部 0: 礼金, 1:实物奖
   * @param {number} pageSize 每页大小
   * @param {number} pageNum 页码
   * @param {func} handleCallback (hasData?) => void 成功回调
   */
  public handleDrawGiftRecordsGet = (
    payload: {
      activityId: string;
      playId: number;
      pageSize: number;
      pageNum: number;
      category: undefined | number;
    },
    handleCallback?: (hasData?) => void,
  ) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_RECORDS_POST_EPIC,
      payload,
      handleCallback,
    });
  };

  /**
   * 获奖记录统计数据列表
   * @param {number} activityId 活动ID
   * @param {number} playId 活动ID
   * @param {number} category 不传:全部 0: 礼金, 1:实物奖
   * @param {number} pageSize 每页大小
   * @param {number} pageNum 页码
   * @param {func} handleCallback () => void 成功回调
   */
  public handleStatisticRecordsGet = (
    payload: {
      activityId: string;
      playId: number;
      pageSize: number;
      pageNum: number;
      category?: number;
    },
    handleCallback?: () => void,
  ) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_STATISTIC_RECORDS_POST_EPIC,
      payload,
      handleCallback,
    });
  };

  /**
   * 领取奖品
   * @param {number} id 奖品记录ID
   * @param {string} address? 收货人地址
   * @param {string} province? 省
   * @param {string} receiver? 收货人
   * @param {string} city? 市
   * @param {string} phone? 收货人电话
   * @param {boolean} saveAddress? 是否保存收货地址
   * @param {string} district? 区
   * @param {string} giftProperty? 奖品属性
   * @param {func} handleCallback () => void 领取成功
   */
  public handleDrawGiftGetPrize = (
    payload: {
      id: number;
      activityId?: string;
      address?: string;
      province?: string;
      receiver?: string;
      city?: string;
      phone?: string;
      saveAddress?: boolean;
      district?: string;
      giftProperty?: string;
    },
    handleCallback: () => void,
  ) => {
    this.props.dispatch({
      type: drawGiftAction.DRAWGIFT_GET_PRIZE_POST_EPIC,
      payload,
      handleCallback,
    });
  };

  /**
   * 设置弹窗信息
   * @string modalType 弹窗类型
   * @array awardList 所种礼品列表
   * @param awardInfo? 领取弹窗接受的单个礼品信息
   */
  public handleSetModalInfo = (params: {
    modalType: 'draw' | 'get_award' | 'login' | 'deposit';
    awardList?: Array<any>;
    awardInfo?: any;
  }) => {
    const { modalType, awardList, awardInfo } = params;
    document.body.style.overflowY = 'hidden';
    this.setState({
      modalInfo: {
        isShow: true,
        modalType,
        awardList,
        awardInfo,
      },
    });
  };

  // 关闭弹窗
  public handleCloseModal = () => {
    const { showRecordsTable } = this.state;
    if (!showRecordsTable) {
      document.body.style.overflowY = '';
    }
    this.setState({
      modalInfo: { isShow: false, modalType: '', awardInfo: {}, awardList: [] },
      rotateNum: 0,
      showSuccessModal: false,
    });
  };

  // 渲染弹窗
  public renderModal = () => {
    const { receiverInfo, showRecordsTable, showSuccessModal } = this.state;
    const { modalType, awardList, awardInfo } = this.state.modalInfo;
    const { depositRequirementsAmount = 0, money = 0 } =
      this.props.currPlayInfo;
    if (modalType === 'draw') {
      const needTip = awardList.find((award) => award.giftType === 2);
      const isSingle = awardList.length === 1;

      return (
        <div className={styles.drawMask}>
          <div
            style={{
              backgroundImage: `url(${redGiftImg})`,
            }}
            className={styles.modal_bg}
          >
            <div className={styles.modal_content}>
              {isSingle && awardList[0].giftType === 3 ? (
                // 一个空白奖
                <div className={styles.empty}>
                  <section>
                    <h2>
                      {awardList[0].blankAwardHint || '感谢您的参与请再接再厉'}
                    </h2>
                  </section>
                  <div className={styles.buttons}>
                    <span
                      className={styles.btn_single}
                      onClick={this.handleCloseModal}
                    >
                      确定
                    </span>
                  </div>
                </div>
              ) : (
                <section>
                  <div className={styles.gongxi}>
                    <h2>恭喜您抽中</h2>
                  </div>
                  <div
                    className={[
                      styles.awardsList,
                      isSingle
                        ? styles.oneAward
                        : awardList.length < 6
                          ? styles.oneColumn
                          : styles.doubleColumn,
                    ].join(' ')}
                  >
                    <article>
                      {awardList.map((award, index) => (
                        <p key={index}>
                          {award.giftType === 1
                            ? award.awardsName +
                            '：' +
                            parseInt(award.giftAmount) + intl.get('HM')
                            : award.giftType === 2
                              ? award.awardsName + '：' + award.giftName
                              : award.blankAwardHint || '谢谢参与'}
                        </p>
                      ))}
                    </article>
                  </div>
                  <div className={styles.btnAndtip}>
                    {isSingle && awardList[0].giftType === 2 ? (
                      // 1个实物奖
                      <div className={styles.buttons}>
                        <span onClick={this.handleCloseModal}>稍后领取</span>
                        <span
                          onClick={() => {
                            this.handleSetModalInfo({
                              modalType: 'get_award',
                              awardInfo: awardList[0],
                            });
                          }}
                        >
                          领取奖品
                        </span>
                      </div>
                    ) : (
                      <div className={styles.buttons}>
                        <span
                          className={styles.btn_single}
                          onClick={this.handleCloseModal}
                        >
                          确定
                        </span>
                      </div>
                    )}
                    {needTip ? (
                      isSingle ? (
                        <p>
                          温馨提示：如果您选择稍后领取，稍后可前往本页面的【记录】进行领取操作
                        </p>
                      ) : (
                        <p>
                          温馨提示：您抽中的实物奖品，可前往本页面的【记录】进行领取操作
                        </p>
                      )
                    ) : null}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      );
    } else if (modalType === 'get_award') {
      return (
        <GetAwardModal
          awardName={awardInfo.giftName}
          receiverInfo={receiverInfo}
          awardPictures={[awardInfo.giftImg]}
          isVirtual={awardInfo.category === 0}
          awardAttribute={awardInfo.giftProperty || '默认属性'}
          onClose={this.handleCloseModal}
          showSuccessModal={showSuccessModal}
          onSubmit={(submitInfo) => {
            this.handleDrawGiftGetPrize(
              {
                activityId: this.activityId,
                id: awardInfo.id,
                ...submitInfo,
              },
              () => {
                // 这点要区分奖品记录表格是否开启
                if (showRecordsTable) {
                  // 如果开启，领奖成功，要改变列表中这条状态
                  this.props.dispatch({
                    type: drawGiftAction.DRAW_CHANGE_PRIZE_LIST_ITEM_STATUS_BY_ID_REDUCE,
                    payload: { id: awardInfo.id },
                  });
                }
                // 如果选择了保存地址，需要更新一下收货人信息
                this.handleReceiverInfoGet({
                  activityId: this.activityId,
                });
                // if (submitInfo.saveAddress) {
                // }
                this.setState({ showSuccessModal: true });
              },
            );
          }}
        />
      );
    } else if (modalType === 'login') {
      return (
        <div
          className={[
            getAwardModalStyles.getAwardMask,
            styles.getAwardMask,
          ].join(' ')}
        >
          <div className={getAwardModalStyles.successModal}>
            <h2>温馨提示</h2>
            <i
              className={getAwardModalStyles.close}
              onClick={this.handleCloseModal}
            ></i>
            <div className={getAwardModalStyles.success}>
              请登录后，再进行操作
            </div>
            <div className={getAwardModalStyles.btns}>
              <button
                className={getAwardModalStyles.cancel}
                onClick={this.handleCloseModal}
              >
                取消
              </button>
              <button
                onClick={() => {
                  this.handleCloseModal();
                  this.props.history.push('/login');
                }}
              >
                前往登录
              </button>
            </div>
          </div>
        </div>
      );
    } else if (modalType === 'deposit') {
      return (
        <div
          className={[
            getAwardModalStyles.getAwardMask,
            styles.getAwardMask,
          ].join(' ')}
        >
          <div className={getAwardModalStyles.successModal}>
            <h2>温馨提示</h2>
            <i
              className={getAwardModalStyles.close}
              onClick={this.handleCloseModal}
            ></i>
            <div className={getAwardModalStyles.success}>
              您尚未达到参与要求：
              {helpers.formatNumberRgx(depositRequirementsAmount)}
              <br />
              仍需{helpers.formatNumberRgx(Number(money).toFixed(2))}
              ，才能参与
            </div>
            <div className={getAwardModalStyles.btns}>
              <button
                className={getAwardModalStyles.cancel}
                onClick={this.handleCloseModal}
              >
                取消
              </button>
              <button
                onClick={() => {
                  this.handleCloseModal();
                  this.props.history.push('/app/myCenter/deposit');
                }}
              >
                去
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return null;
    }
  };

  // 打开表格
  public handleOpenTable = () => {
    document.body.style.overflowY = 'hidden';
    this.setState({ showRecordsTable: true });
  };

  // 关闭表格
  public handleCloseTable = () => {
    document.body.style.overflowY = '';
    this.setState({
      showRecordsTable: false,
      recordsTabType: 'detail',
      detailTabIndex: 0,
      statisticTabIndex: 0,
      reloadStatisticRecords: true,
    });
  };

  /**
   * 点击按钮
   * @param {number} drawNum 次数： 1次：1,所有：0
   */
  public handleDraw = (drawNum: number) => {
    const { tabIndex } = this.state;
    const { currPlayInfo } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    if (!getToken()) {
      this.handleSetModalInfo({ modalType: 'login' });
      return;
    }
    if (currPlayInfo.code === 60016) {
      this.handleSetModalInfo({ modalType: 'deposit' });
      return;
    }
    if (!currPlayInfo.drawNum) {
      Toast.info('暂无可用次数');
      return;
    }
    this.handleStartLoading();
    this.handleDrawPost(
      {
        activityId: this.activityId,
        playId: current.id,
        drawNum,
      },
      (response) => {
        const awardList = get(response, 'data.list');
        if (awardList && awardList.length) {
          this.handleSetModalInfo({ modalType: 'draw', awardList });
          // 往跑马灯加数据
          this.handleUpdateWinnerList(awardList);
        } else {
          // 失败后，重新获取当前玩法信息
          this.handleCurrPlayInfoGet({
            activityId: this.activityId,
            playId: current.id,
          });
        }
      },
    );
  };

  // 点击转盘
  public handleClickTurntable = () => {
    const { tabIndex } = this.state;
    const { currPlayInfo } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    if (this.timer1 || this.timer2) {
      Toast.info('请勿重复点击');
      return;
    }
    if (!getToken()) {
      this.handleSetModalInfo({ modalType: 'login' });
      return;
    }
    if (currPlayInfo.code === 60016) {
      this.handleSetModalInfo({ modalType: 'deposit' });
      return;
    }
    if (!currPlayInfo.drawNum) {
      Toast.info('暂无可用次数');
      return;
    }
    this.handleStartRotation(1);
    this.handleDrawPost(
      {
        activityId: this.activityId,
        playId: current.id,
        drawNum: 1,
      },
      (response) => {
        const awardList = get(response, 'data.list');
        if (awardList && awardList.length) {
          const indexList = new Array();
          forEach(current.tenAwardsList, (award, index) => {
            if (award.awardsName === awardList[0].awardsName) {
              indexList.push(index);
            }
          });
          const prizeIndex =
            indexList[Math.floor(Math.random() * indexList.length)];
          if (prizeIndex !== undefined) {
            this.handleStopRotation(
              current.tenAwardsList.length,
              prizeIndex,
              () => {
                this.handleSetModalInfo({ modalType: 'draw', awardList });
                // 往跑马灯加数据
                this.handleUpdateWinnerList(awardList);
              },
            );
          } else {
            cancelAnimationFrame(this.timer1);
            this.timer1 = 0;
            this.setState({ rotateNum: 0 });
          }
        } else {
          cancelAnimationFrame(this.timer1);
          this.timer1 = 0;
          this.setState({ rotateNum: 0 });
          // 失败后，重新获取当前玩法信息
          this.handleCurrPlayInfoGet({
            activityId: this.activityId,
            playId: current.id,
          });
        }
      },
    );
  };

  // 匀加速转动转盘
  public handleStartRotation = (times: number) => {
    if (this.state.rotateNum > 360) {
      this.setState({ rotateNum: 0 });
    }
    times = times + 1;
    let stepNum = (times * times) / 1000;
    if (stepNum > 30) {
      stepNum = 30;
    }
    this.timer1 = requestAnimationFrame(() => {
      const { rotateNum } = this.state;
      this.setState({ rotateNum: rotateNum + stepNum });
      this.handleStartRotation(times);
    });
  };

  /**
   * 成功，停止 timer1 开启 timer2
   * @number 奖励的数量，用于计算转盘指针停留位置
   * @number 抽中的奖励序号 转盘指针停留位置
   * @func handleCallback 指针停留回调
   */
  public handleStopRotation = (
    totalPrize: number,
    prizeIndex: number,
    handleCallback: () => void,
  ) => {
    setTimeout(() => {
      cancelAnimationFrame(this.timer1);
      this.timer1 = 0;
      this.handleStopAnimation(
        Math.ceil(this.state.rotateNum / 360) * 360 +
        360 * 2 -
        (360 / totalPrize) * prizeIndex -
        180 / totalPrize,
        handleCallback,
      );
    }, 3000);
  };

  /**
   * 转盘缓慢停止
   * @number angle 转盘最终需要停留的度数
   * @func handleCallback 指针停留回调
   */
  public handleStopAnimation = (angle: number, handleCallback: () => void) => {
    const leftNum = angle - this.state.rotateNum;
    if (leftNum < 0) {
      cancelAnimationFrame(this.timer2);
      this.timer2 = 0;
      handleCallback();
      return;
    }
    let stepNum = 30 * (leftNum / angle);
    if (stepNum < 0.2) {
      stepNum = 0.2;
    }
    this.timer2 = requestAnimationFrame(() => {
      const { rotateNum } = this.state;
      this.setState({ rotateNum: rotateNum + stepNum });
      this.handleStopAnimation(angle, handleCallback);
    });
  };

  // 渲染banner
  public renderBanner = () => {
    const { webBanner, playList } = this.props.drawGiftConfig;
    return (
      <div
        className={styles.banner}
        style={
          playList.length > 1
            ? { minHeight: '88px', backgroundImage: `url(${webBanner})` }
            : { backgroundImage: `url(${webBanner})` }
        }
      >
        {webBanner ? (
          <img
            src={webBanner}
            width={'1920px'}
            className={styles.placeHolder}
          />
        ) : null}
      </div>
    );
  };

  // 渲染tabs
  public renderTabs = () => {
    const { tabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;

    if (playList.length > 1) {
      return (
        <ul className={styles.tabs}>
          {playList.map((item, index) => {
            return (
              <li
                key={index}
                className={tabIndex === index ? styles.selected : null}
              >
                <span
                  onClick={() => {
                    if (this.timer1 || this.timer2) {
                      Toast.info('中，请勿切换玩法');
                      return;
                    }
                    if (getToken()) {
                      this.props.dispatch({
                        type: drawGiftAction.CURRENT_PLAY_INFO_POST_REDUCE,
                        payload: {},
                      });
                      this.handleCurrPlayInfoGet({
                        activityId: this.activityId,
                        playId: playList[index].id,
                      });
                    }
                    this.props.dispatch({
                      type: drawGiftAction.DRAWGIFT_WINNER_LIST_POST_REDUCE,
                      payload: { data: '加载中', tabIndex: index },
                    });
                    this.handleDrawGiftWinnerListGet({
                      activityId: this.activityId,
                      playId: playList[index].id,
                      tabIndex: index,
                    });
                    this.setState({ tabIndex: index });
                  }}
                >
                  {item.titleWeb}
                </span>
              </li>
            );
          })}
        </ul>
      );
    } else {
      return null;
    }
  };

  // 渲染转盘区域
  public renderTurntable = () => {
    const { rotateNum, tabIndex } = this.state;
    const { code } = this.props.currPlayInfo;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    const notStart = Date.now() < moment(current.lotteryStart).valueOf();
    const inProgress =
      moment(current.lotteryStart).valueOf() < Date.now() &&
      Date.now() < moment(current.lotteryEnd).valueOf();
    const isEnd = Date.now() > moment(current.lotteryEnd).valueOf();
    const r = 300; // 圆盘半径

    return (
      <div className={styles.turntableBox}>
        {current.lotteryStyle === 2 ? (
          <section>
            <div
              className={styles.rotateBg}
              style={{
                transform: `rotate(${rotateNum}deg)`,
                backgroundImage: `url(${rotateBgImg})`,
              }}
            >
              {current.tenAwardsList.map((item, index) => {
                return (
                  <div
                    key={index}
                    style={{
                      transform: `rotate(${(360 / current.tenAwardsList.length) * (index + 0.5)
                        }deg)`,
                    }}
                  >
                    <dl
                      style={{
                        width: `${Math.sin(Math.PI / current.tenAwardsList.length) *
                          r *
                          2
                          }px`,
                      }}
                    >
                      <dt>
                        <p>{item.awardsName}</p>
                      </dt>
                      <dd
                        style={{
                          background: `url(${item.giftImgUrl}) center / contain no-repeat`,
                        }}
                      ></dd>
                    </dl>
                  </div>
                );
              })}
            </div>
            <div
              className={[
                styles.pointer,
                inProgress && code !== 60015 ? null : styles.disabled,
              ].join(' ')}
            >
              <article onClick={this.handleClickTurntable}>
                {notStart ? (
                  <span>
                    {moment(current.lotteryStart).format('M月D日')}
                    <br />
                    开抽
                  </span>
                ) : isEnd ? (
                  <span>
                    已
                    <br />
                    结束
                  </span>
                ) : (
                  <span>
                    立即
                    <br />
                    
                  </span>
                )}
              </article>
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  // 渲染当前用户次数等信息
  public renderUserDrawInfo = () => {
    const { tabIndex, detailTabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const {
      memberGrade,
      code,
      money,
      show,
      backwardsCount,
      awardsName,
      awardsContent,
      drawNum,
      expireAt,
      limit,
    } = this.props.currPlayInfo;
    const current = playList[tabIndex];
    const notStart = Date.now() < moment(current.lotteryStart).valueOf();
    const inProgress =
      moment(current.lotteryStart).valueOf() < Date.now() &&
      Date.now() < moment(current.lotteryEnd).valueOf();
    const isEnd = Date.now() > moment(current.lotteryEnd).valueOf();
    return (
      <ul className={styles.userDrawInfo}>
        {!getToken() ? (
          <li
            className={styles.login}
            onClick={() => {
              this.handleSetModalInfo({ modalType: 'login' });
            }}
          >
            登录后可查看您的次数
          </li>
        ) : code === 60015 ? (
          <li className={styles.dissatisfy}>
            您是VIP{memberGrade}，不符合活动对象要求，请查看或参与其他活动
          </li>
        ) : (
          <>
            {code === 60016 ? (
              <li className={styles.needDeposit}>
                仍需
                {helpers.formatNumberRgx((Number(money) || 0).toFixed(2))}
                ，才能参与&nbsp;&nbsp;&nbsp;
                <a
                  onClick={() => {
                    this.props.history.push('/app/myCenter/deposit');
                  }}
                >
                  点击去
                </a>
              </li>
            ) : null}
            {show ? (
              <li className={styles.countdown}>
                <div>
                  <article>
                    <img
                      src={
                        '/assets/commons/images/activity/draw-gift/gift@2x.webp'
                      }
                    />
                    再抽<span>{backwardsCount}</span>
                    次，必中{awardsName}：{awardsContent}
                    {limit ? ' 名额有限，先到先得' : null}
                  </article>
                </div>
              </li>
            ) : null}
            <li className={styles.count}>
              <div className={styles.num}>
                可抽
                <span className={styles.draw_time}>{drawNum || 0}</span>次
              </div>
            </li>
          </>
        )}
        <li className={styles.expiredAndRecords}>
          {getToken() && expireAt && drawNum > 0 ? (
            <div className={styles.expired}>
              次数将在{moment(expireAt).format('M月D日 H:mm:ss')}失效
            </div>
          ) : null}
          <div
            className={[styles.records].join(' ')}
            onClick={() => {
              if (getToken()) {
                if (this.timer1 || this.timer2) {
                  Toast.info('请等待结束后查看');
                  return;
                }
                this.handleDrawGiftRecordsGet(
                  {
                    activityId: this.activityId,
                    playId: current.id,
                    pageSize: this.pageSize,
                    pageNum: 1,
                    category: this.recordsTabs[detailTabIndex].category,
                  },
                  () => {
                    this.handleOpenTable();
                  },
                );
              } else {
                this.handleSetModalInfo({ modalType: 'login' });
              }
            }}
          >
            查看您的记录&nbsp;&gt;&gt;
          </div>
        </li>
        {current.lotteryStyle === 2 ? null : (
          <li
            className={[
              styles.drawBtns,
              !getToken() || (inProgress && code !== 60015)
                ? null
                : styles.disabled,
            ].join(' ')}
          >
            {notStart ? (
              <p>将在{moment(current.lotteryStart).format('M月D日')}开始</p>
            ) : isEnd ? (
              <p>已结束</p>
            ) : inProgress ? (
              <>
                <button
                  className={styles.one}
                  onClick={this.handleDraw.bind(this, 1)}
                >
                  立即
                </button>
                <button
                  className={styles.ten}
                  onClick={this.handleDraw.bind(this, 0)}
                >
                  10连抽
                </button>
              </>
            ) : null}
          </li>
        )}
      </ul>
    );
  };

  // 渲染活动部分
  public renderDrawBox = () => {
    const { tabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    return (
      <div
        style={{ backgroundImage: `url(${current.schematicDiagramWeb || ''})` }}
        className={styles.drawBox}
      >
        <div>
          {this.renderTabs()}
          {this.renderTurntable()}
          {this.renderUserDrawInfo()}
        </div>
      </div>
    );
  };

  // 渲染当前玩法信息
  public renderCurrInfo = () => {
    const { tabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    return (
      <div className={styles.currInfo}>
        <h2 className={styles.title}></h2>
        <dl>
          <dt>活动对象：</dt>
          <dd>{current.vipLevelHint}</dd>
        </dl>
        {current.depositRequirements === 1 ? (
          <dl>
            <dt>参与要求：</dt>
            <dd>
              活动期间达到
              {helpers.formatNumberRgx(current.depositRequirementsAmount || 0)}
              ，即可参与
            </dd>
          </dl>
        ) : current.depositRequirements === 2 ? (
          <dl>
            <dt>参与要求：</dt>
            <dd>
              每日达到
              {helpers.formatNumberRgx(current.depositRequirementsAmount || 0)}
              ，即可参与当日
            </dd>
          </dl>
        ) : null}
        <dl>
          <dt>次数：</dt>
          <dd>
            每{helpers.formatNumberRgx(current.moneyEach || 0)}
            {current.getStyle === 1
              ? ''
              : current.getStyle === 0 && current.allGameVenue
                ? '有效'
                : current.getStyle === 0
                  ? '指定的有效'
                  : ''}
            可获得1次机会
          </dd>
        </dl>
        <dl>
          <dt>时间：</dt>
          <dd>
            {current.lotteryStart.replace(/-/g, '/')}&nbsp;至&nbsp;
            {current.lotteryEnd.replace(/-/g, '/')}
          </dd>
        </dl>
      </div>
    );
  };

  // 渲染中奖者列表
  public renderWinnerList = () => {
    const { tabIndex } = this.state;
    const { currWinnerList } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    const list = currWinnerList[tabIndex];

    return (
      <div className={styles.winnerList}>
        <h2 className={styles.title}></h2>
        {Date.now() < moment(current.lotteryStart).valueOf() ? (
          <p>{moment(current.lotteryStart).format('M月D日')}开始</p>
        ) : Date.now() > moment(current.lotteryEnd).valueOf() ? (
          <p>已结束</p>
        ) : list === '加载中' ? (
          <p>加载中</p>
        ) : isArray(list) && list.length === 0 ? (
          <p>暂无中奖信息</p>
        ) : isArray(list) && list.length > 0 ? (
          <WinnerList list={list} />
        ) : (
          <p>加载失败，请稍后再试</p>
        )}
      </div>
    );
  };

  // 渲染活动奖品图片
  public renderGifsPicture = () => {
    const { tabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];

    if (isEmpty(current.prizeListWeb)) {
      return null;
    } else {
      return (
        <section className={styles.giftsPicture}>
          <div>
            <img src={current.prizeListWeb} width="900" />
          </div>
        </section>
      );
    }
  };

  public onPlay = () => {
    this.videoRef?.current?.play();
    this.setState({ showPlay: false });
  };

  // 渲染活动视频
  public renderVideo = () => {
    const { showPlay } = this.state;

    const {
      showVideo,
      videoTitle,
      videoUrl = '',
      videoDesc,
      videoPictureUrl,
    } = this.props.drawGiftConfig;
    if (showVideo) {
      return (
        <section className={styles.video}>
          <div>
            <h2 className={styles.title}>
              <i className={styles.left}></i>
              {videoTitle}
              <i className={styles.right}></i>
            </h2>
            <div className={styles.media}>
              <video
                preload="metadata"
                poster={videoPictureUrl}
                controls
                controlsList="nodownload"
                src={videoUrl}
                ref={this.videoRef}
              ></video>
              {showPlay ? (
                <div
                  className={styles.poster}
                  style={{ backgroundImage: `url(${videoPictureUrl})` }}
                  onClick={this.onPlay}
                >
                  <Play />
                </div>
              ) : null}
            </div>
            <div
              className={styles.text}
              dangerouslySetInnerHTML={{
                __html: videoDesc,
              }}
            />
          </div>
        </section>
      );
    } else {
      return null;
    }
  };

  // 渲染活动规则
  public renderRules = () => {
    const { webActivityDesc } = this.props.drawGiftConfig;
    // 以下代码若有冲突 请保溜无默认值【活动规则】处，此处因线上bug所以删除
    return (
      <section className={styles.rules}>
        <h2 className={styles.title}></h2>
        <div
          dangerouslySetInnerHTML={{
            __html: webActivityDesc,
          }}
        ></div>
      </section>
    );
  };

  // 明细表结构
  private detailColumns: any = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      align: 'center',
      width: 100,
      render: (text, record, index) => {
        return <span key={index}>{index + 1}</span>;
      },
    },
    {
      title: '中奖时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center',
      width: 218,
    },
    {
      title: '抽中奖励',
      dataIndex: 'awardName',
      key: 'awardName',
      align: 'center',
      width: 243,
      render: (text, record, index) => {
        switch (record.giftType) {
          case 1:
            return <span>{parseInt(record.giftAmount)}礼金</span>;
            break;
          case 2:
            return <span>{record.giftName}</span>;
            break;
          case 3:
            return <span>{record.blankAwardHint || '谢谢参与'}</span>;
            break;
          default:
            return <span></span>;
            break;
        }
      },
    },
    {
      title: '操作',
      dataIndex: 'operating',
      key: 'operating',
      align: 'center',
      render: (text, record, index) => {
        if (record.giftType === 2) {
          if (record.isGet === 1) {
            return (
              <span
                className={styles.btn}
                onClick={() => {
                  this.handleCloseModal();
                  this.handleCloseTable();
                  this.props.history.push('/app/myCenter/giftRecord');
                }}
              >
                查看【兑奖记录】
              </span>
            );
          } else {
            return (
              <span
                className={styles.btn}
                onClick={() => {
                  this.handleSetModalInfo({
                    modalType: 'get_award',
                    awardInfo: record,
                  });
                }}
              >
                领取奖品
              </span>
            );
          }
        } else {
          return null;
        }
      },
    },
  ];

  // 统计表结构
  private statisticColumns: any = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      align: 'center',
      width: 124,
      render: (text, record, index) => {
        return <span key={index}>{index + 1}</span>;
      },
    },
    {
      title: '抽中奖励',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      render: (text, record, index) => {
        switch (record.type) {
          case 1:
            return <span>{record.name}礼金</span>;
            break;
          case 2:
            return <span>{record.name}</span>;
            break;
          case 3:
            return <span>{record.name || '谢谢参与'}</span>;
            break;
          default:
            return <span></span>;
            break;
        }
      },
    },
    {
      title: '总计数量',
      dataIndex: 'num',
      key: 'num',
      align: 'center',
      width: 300,
      render: (text, record, index) => {
        return text;
      },
    },
  ];

  public recordsTypeTabs: Array<{
    name: string;
    type: 'detail' | 'statistic';
  }> = [
      { name: '明细记录', type: 'detail' },
      { name: '统计数据', type: 'statistic' },
    ];

  public recordsTabs = [
    { name: '全部', category: undefined },
    { name: '奖品', category: 1 },
    { name: '礼金', category: 0 },
  ];

  // 点击明细和统计分类tab
  public handleClickTypeTab = (type: 'detail' | 'statistic') => {
    const { tabIndex, recordsTabType, reloadStatisticRecords } = this.state;
    const { recordsDetailInfo, recordsStatisticInfo } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    if (recordsTabType === type) {
      return;
    }
    if (type === 'detail' && isEmpty(recordsDetailInfo.list)) {
      this.handleDrawGiftRecordsGet({
        pageNum: 1,
        activityId: this.activityId,
        playId: current.id,
        pageSize: this.pageSize,
        category: this.recordsTabs[0].category,
      });
      this.setState({ detailTabIndex: 0 });
    }
    if (
      type === 'statistic' &&
      (isEmpty(recordsStatisticInfo.list) || reloadStatisticRecords)
    ) {
      this.handleStatisticRecordsGet({
        pageNum: 1,
        activityId: this.activityId,
        playId: current.id,
        pageSize: this.pageSize,
        category: this.recordsTabs[0].category,
      });
      this.setState({ statisticTabIndex: 0, reloadStatisticRecords: false });
    }
    this.setState({ recordsTabType: type });
  };

  // 点击全部/奖品/礼金tab
  public handleClickCateTab = (index: number) => {
    const { tabIndex, recordsTabType } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];

    if (recordsTabType === 'detail') {
      this.handleDrawGiftRecordsGet({
        pageNum: 1,
        activityId: this.activityId,
        playId: current.id,
        pageSize: this.pageSize,
        category: this.recordsTabs[index].category,
      });
      this.setState({ detailTabIndex: index });
    }
    if (recordsTabType === 'statistic') {
      this.handleStatisticRecordsGet({
        pageNum: 1,
        activityId: this.activityId,
        playId: current.id,
        pageSize: this.pageSize,
        category: this.recordsTabs[index].category,
      });
      this.setState({ statisticTabIndex: index });
    }
  };

  // 渲染中奖记录弹窗表格
  public renderRecordsTable = () => {
    const { tabIndex, detailTabIndex, statisticTabIndex, recordsTabType } =
      this.state;
    const { recordsDetailInfo, recordsStatisticInfo } = this.props;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];

    let recordsTabIdx = detailTabIndex;
    let columns = this.detailColumns;
    let recordsInfo = recordsDetailInfo;
    if (recordsTabType === 'statistic') {
      recordsTabIdx = statisticTabIndex;
      columns = this.statisticColumns;
      recordsInfo = recordsStatisticInfo;
    }
    recordsInfo.total === '0' && (recordsInfo.total = 1);
    return (
      <div className={styles.drawMask}>
        <div className={styles.recordsTable}>
          <h2>记录</h2>
          <i onClick={this.handleCloseTable}>
            <img
              src={
                '/assets/commons/images/activity/common/event_icon_close@2x.webp'
              }
            />
          </i>
          <div className={styles.typeTab}>
            {this.recordsTypeTabs.map((item, index) => (
              <div
                key={index}
                className={recordsTabType === item.type ? styles.active : null}
                onClick={this.handleClickTypeTab.bind(this, item.type)}
              >
                {item.name}
              </div>
            ))}
          </div>
          <div className={styles.cateTab}>
            <div>
              {this.recordsTabs.map((item, index) => (
                <span
                  key={index}
                  className={recordsTabIdx === index ? styles.active : null}
                  onClick={this.handleClickCateTab.bind(this, index)}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </div>
          <ul>
            <li>
              奖品总计：
              <span>{helpers.formatNumberRgx(recordsInfo.giftCount || 0)}</span>
              个
            </li>
            <li>
              礼金总计：
              <span>
                {helpers.formatNumberRgx(
                  (Number(recordsInfo.amountCount) || 0).toFixed(2),
                )}
              </span>
              
            </li>
          </ul>
          <Table
            columns={columns}
            dataSource={recordsInfo.list}
            pagination={false}
            className={styles.table}
            bordered={false}
          />
          {recordsInfo.total === 0 && (
            <div className={styles.no_list}>
              <img
                src={'/assets/commons/images/activity/draw-gift/noRecord.webp'}
                width={365}
                height={165}
              />
              <div className={styles.no_list_div}>
                <span>暂无记录</span>
              </div>
            </div>
          )}
          {recordsInfo.total !== 0 ? (
            <div
              className={classnames({
                [styles.recordsPagination]: true,
                ['mycenterPaginations']: true,
              })}
            >
              <Pagination
                showQuickJumper={false}
                showSizeChanger={false}
                hideOnSinglePage={false}
                defaultCurrent={recordsInfo.pageNum}
                current={recordsInfo.pageNum}
                total={recordsInfo.total}
                pageSize={this.pageSize}
                onChange={(page) => {
                  if (recordsTabType === 'statistic') {
                    this.handleStatisticRecordsGet({
                      pageNum: page,
                      activityId: this.activityId,
                      playId: current.id,
                      pageSize: this.pageSize,
                      category: this.recordsTabs[recordsTabIdx].category,
                    });
                  } else {
                    this.handleDrawGiftRecordsGet({
                      pageNum: page,
                      activityId: this.activityId,
                      playId: current.id,
                      pageSize: this.pageSize,
                      category: this.recordsTabs[recordsTabIdx].category,
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // 弹窗的背景图。需要提前加载，避免背景空白一段时间
  public preloadImg = () => {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          backgroundImage: `url('/assets/commons/images/activity/draw-gift/red-gift.webp')`,
        }}
      />
    );
  };

  public render() {
    const { modalInfo, showRecordsTable } = this.state;
    const { tabIndex } = this.state;
    const { playList } = this.props.drawGiftConfig;
    const current = playList[tabIndex];
    return (
      <div className={[styles.drawGift].join(' ')}>
        {this.preloadImg()}
        {this.renderBanner()}
        {this.renderDrawBox()}
        <div
          className={styles.wrap}
          style={{
            background: `url(${current.ruleBackgroundWeb}) center top / auto auto repeat-y`,
          }}
        >
          <div className={styles.top_box}>
            {this.renderCurrInfo()}
            {this.renderWinnerList()}
          </div>
          {this.renderGifsPicture()}
          {this.renderVideo()}
          {this.renderRules()}
        </div>
        {showRecordsTable ? this.renderRecordsTable() : null}
        {modalInfo.isShow ? this.renderModal() : null}
      </div>
    );
  }
}
export default connector(DrawGift);
