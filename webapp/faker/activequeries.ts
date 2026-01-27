import { faker } from "@faker-js/faker";

// cố định data khi reload
faker.seed(2025);

// Tạo 1 node con ngẫu nhiên (name + icon) để hiển thị trong tree/list
function fakeNode() {
  return {
    id: faker.string.uuid(),
    name:
      faker.helpers.arrayElement([
        "Khởi tạo",
        "Phê duyệt",
        "Trình",
        "Save draft",
        "Chấm điểm"
      ]) +
      " " +
      faker.commerce.productName(),
    icon: "sap-icon://folder"
  };
}

// Tạo 1 bước (query) gồm tên, icon và danh sách node con
function fakeQuery(step: number) {
  return {
    id: faker.string.uuid(),
    name: `B${step}: ${faker.company.catchPhrase()}`,
    icon: "sap-icon://folder-blank",
    nodes: Array.from(
      { length: faker.number.int({ min: 2, max: 4 }) },
      fakeNode
    )
  };
}

// Dữ liệu fake tổng hợp để bind trực tiếp vào model/UI
export const XayDungToTrinhLeftData = {
  queries: Array.from({ length: 7 }, (_, i) => fakeQuery(i + 1))
};

// --- Tạo dữ liệu con gắn với node cha ---
export const XayDungToTrinhDetailData = {
  dulieu: XayDungToTrinhLeftData.queries.flatMap((query) =>
    query.nodes.flatMap((node) =>
      Array.from({ length: faker.number.int({ min: 4, max: 10 }) }, () => ({
        Id: faker.helpers.slugify(node.name).toLowerCase() + "-" + faker.string.numeric(3),
        Subject: `Draft: ${node.name}`,
        From: faker.internet.email(),
        Priority: faker.helpers.arrayElement(["High", "Medium", "Low"]),
        SentOn: faker.date.recent({ days: 30 }).toISOString().split("T")[0],
        Duedate: faker.date.soon({ days: 30 }).toISOString().split("T")[0],
        Status: faker.helpers.arrayElement(["01", "02", "03"]),
        ForwardedBy: faker.person.fullName(),
        idCha: node.id, // liên kết với node cha
      }))
    )
  ),
};

// Tạo dữ liệu cho select tìm kiếm ở đầu bảng
export const StatusSelectData = {
  items: [
    { key: "5", text: "All" },
    ...["In progress and New", "In progress", "New", "Rejected"].map(
      (text, index) => ({
        key: String(index + 1),
        text
      })
    )
  ]
};