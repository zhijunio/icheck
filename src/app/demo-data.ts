export type InspectionArea = {
  name: string;
  items: string[];
};

export type DemoTemplate = {
  id: string;
  name: string;
  scenario: string;
  categories: InspectionArea[];
};

export type AreaSortMode = "default" | "frequent" | "ai";

export const areaSortModeLabels: Record<AreaSortMode, string> = {
  default: "默认排序",
  frequent: "用户常用路径",
  ai: "AI 推荐路径",
};

export function sortAreaIndexes(areas: InspectionArea[], mode: AreaSortMode, visitCounts: Record<number, number> = {}) {
  const indexes = areas.map((_, index) => index);
  if (mode === "default") return indexes;
  if (mode === "frequent" && Object.values(visitCounts).some((count) => count > 0)) {
    return indexes.sort((left, right) => (visitCounts[right] ?? 0) - (visitCounts[left] ?? 0) || left - right);
  }
  if (mode === "ai") {
    return indexes.sort((left, right) => aiAreaOrder(areas[left].name) - aiAreaOrder(areas[right].name) || left - right);
  }
  return indexes;
}

function aiAreaOrder(name: string) {
  if (/入口|门口|前场|前厅/.test(name)) return 10;
  if (/卖场|商品|陈列|展示/.test(name)) return 20;
  if (/试衣/.test(name)) return 30;
  if (/收银/.test(name)) return 40;
  if (/设备|冷藏|冷冻|后厨/.test(name)) return 50;
  if (/仓储|仓库/.test(name)) return 60;
  if (/消防|安全/.test(name)) return 70;
  return 50;
}

export const demoTemplates: DemoTemplate[] = [
  {
    id: "1",
    name: "门店日常巡检",
    scenario: "通用门店 · 关店前巡检",
    categories: [
      { name: "入口及前场", items: ["入口通道无杂物和障碍物", "地面无明显垃圾或积水"] },
      { name: "商品陈列区", items: ["商品陈列整齐且无明显空缺", "商品和货架表面无明显灰尘和污渍"] },
    ],
  },
  {
    id: "2",
    name: "服装店营业巡检",
    scenario: "服装门店 · 营业中巡检",
    categories: [
      { name: "门店入口", items: ["橱窗和入口区域整洁", "门店标识和灯光正常"] },
      { name: "卖场区域", items: ["商品陈列整齐且无明显空缺", "顾客通道保持畅通"] },
    ],
  },
];

export const defaultInspectionAreas = demoTemplates[0].categories;
