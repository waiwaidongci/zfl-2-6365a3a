export const TABLES = {
  costumes: 'costumes',
  records: 'records',
  reservations: 'reservations',
  workOrders: 'workOrders',
  actors: 'actors',
  packingLists: 'packingLists',
  schedules: 'schedules',
  inventoryTasks: 'inventoryTasks',
  inventoryItems: 'inventoryItems',
  riskStatuses: 'riskStatuses',
  syncEvents: 'syncEvents',
  tombstones: 'tombstones'
};

export const RISK_STATUS = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已解决',
  IGNORED: '已忽略'
};

export const COSTUME_STATUS = {
  IN_STOCK: '在库',
  BORROWED: '借出',
  MAINTENANCE: '维修中',
  CLEANING: '清洗中'
};

export const CLEAN_STATUS = {
  CLEAN: '已清洗',
  DIRTY: '待清洗',
  REPAIR: '维修中'
};

export const WORK_ORDER_STATUS = {
  PENDING: '待处理',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
};

export const RESERVATION_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成'
};

export const PACKING_STATUS = {
  PENDING: '待打包',
  PACKED: '已打包',
  MISSING: '缺失',
  NEEDS_CLEANING: '需清洗',
  RETURNED: '已归还'
};

export const INVENTORY_STATUS = {
  PENDING: '待盘点',
  NORMAL: '正常',
  MISSING: '缺失',
  LOCATION_MISMATCH: '位置不符',
  STATUS_MISMATCH: '状态不符'
};

export const TASK_STATUS = {
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成'
};

export const PLAY_NAMES = [
  '天鹅湖', '胡桃夹子', '睡美人', '吉赛尔', '堂吉诃德',
  '卡门', '茶花女', '罗密欧与朱丽叶', '灰姑娘', '仙女',
  '仲夏夜之梦', '斯巴达克斯', '雷蒙达', '舞姬', '海盗',
  '奥涅金', '曼侬', '克拉拉', '黑桃皇后', '巴黎圣母院'
];

export const COSTUME_NAMES = [
  '白色公主裙', '黑色天鹅裙', '红色斗牛士服', '蓝色王子服',
  '金色宫廷装', '银色精灵装', '粉色芭蕾裙', '紫色女巫袍',
  '绿色森林装', '橙色小丑服', '灰色士兵装', '棕色猎人装',
  '黄色太阳花', '青色美人鱼', '米色婚纱装', '黑色燕尾服',
  '白色衬衫', '蓝色牛仔裤', '红色斗篷', '金色皇冠头饰'
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const LOCATIONS = [
  'A区-1号柜', 'A区-2号柜', 'A区-3号柜', 'A区-4号柜',
  'B区-1号柜', 'B区-2号柜', 'B区-3号柜', 'B区-4号柜',
  'C区-1号柜', 'C区-2号柜', 'C区-3号柜', 'C区-4号柜',
  'D区-1号柜', 'D区-2号柜', 'D区-3号柜', 'D区-4号柜',
  '清洗间', '维修间', '待出库区', '已归还区'
];

export const ACTOR_NAMES = [
  '李明', '王芳', '张伟', '刘洋', '陈静',
  '杨帆', '赵雪', '周杰', '吴敏', '郑涛',
  '孙丽', '钱浩', '马云飞', '朱琳', '胡晓',
  '林涛', '何芳', '罗明', '梁婷', '宋伟'
];

export const VENUES = [
  '国家大剧院', '北京音乐厅', '上海大剧院', '广州大剧院',
  '深圳保利剧院', '杭州大剧院', '南京保利大剧院', '武汉琴台大剧院',
  '成都大剧院', '西安音乐厅', '天津大剧院', '重庆大剧院'
];

export const WORK_ORDER_TYPES = ['清洗', '维修', '改制', '翻新'];

export default {
  TABLES,
  RISK_STATUS,
  COSTUME_STATUS,
  CLEAN_STATUS,
  WORK_ORDER_STATUS,
  RESERVATION_STATUS,
  PACKING_STATUS,
  INVENTORY_STATUS,
  TASK_STATUS,
  PLAY_NAMES,
  COSTUME_NAMES,
  SIZES,
  LOCATIONS,
  ACTOR_NAMES,
  VENUES,
  WORK_ORDER_TYPES
};
