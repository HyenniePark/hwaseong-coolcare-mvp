import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "data", "raw", "hwaseong_hospitals.csv");
const outputPath = path.join(root, "src", "data", "generatedHospitals.ts");

const areaCenters = [
  ["동탄", 37.1992, 127.0984],
  ["병점", 37.206, 127.0335],
  ["진안", 37.2139, 127.0357],
  ["반월", 37.2256, 127.0598],
  ["기배", 37.2212, 126.9817],
  ["화산", 37.2059, 127.0101],
  ["봉담", 37.2203, 126.9498],
  ["향남", 37.1318, 126.9209],
  ["남양", 37.2117, 126.8168],
  ["새솔", 37.283, 126.818],
  ["우정", 37.0862, 126.8172],
  ["장안", 37.0784, 126.8338],
  ["팔탄", 37.1624, 126.9031],
  ["양감", 37.0818, 126.9563],
  ["정남", 37.1612, 126.9711],
  ["매송", 37.2492, 126.9045],
  ["비봉", 37.2357, 126.8748],
  ["마도", 37.2054, 126.7753],
  ["송산", 37.2204, 126.7398],
  ["서신", 37.1665, 126.7082],
];

const defaultCenter = { lat: 37.1996, lng: 126.8312 };

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function findCenter(address) {
  const found = areaCenters.find(([keyword]) => address.includes(keyword));
  if (!found) {
    return defaultCenter;
  }

  return { lat: found[1], lng: found[2] };
}

function isRelevant(row) {
  const name = row["사업장명"] || "";
  const type = row["업태구분명"] || "";
  const address = row["도로명전체주소"] || "";
  const phone = row["소재지전화"] || "";
  const departments = row["진료과목내용명"] || "";
  const text = name + " " + type + " " + departments;

  if (!name || !address || !phone) {
    return false;
  }

  if (/치과|한의원|한방|약국|조산|산후조리|정신병원|요양병원/.test(text)) {
    return false;
  }

  const hospitalLike = /종합병원|병원|보건소|보건지소|보건진료소/.test(type);
  const heatRelatedDept = /내과|가정의학과|응급의학과/.test(departments);
  return hospitalLike || heatRelatedDept;
}

function typePriority(type) {
  if (type.includes("종합병원")) return 0;
  if (type.includes("병원")) return 1;
  if (type.includes("보건")) return 2;
  return 3;
}

const buffer = await readFile(inputPath);
const text = new TextDecoder("euc-kr").decode(buffer);
const lines = text.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines[0]);
const rows = lines.slice(1).map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
});

const hospitals = rows
  .filter(isRelevant)
  .map((row, index) => {
    const address = row["도로명전체주소"];
    const center = findCenter(address);

    return {
      id: "csv-hospital-" + String(index + 1),
      name: row["사업장명"],
      address,
      lat: center.lat,
      lng: center.lng,
      phone: row["소재지전화"],
      type: row["업태구분명"],
      departments: row["진료과목내용명"] || "진료과목 정보 없음",
    };
  })
  .sort((a, b) => typePriority(a.type) - typePriority(b.type) || a.name.localeCompare(b.name, "ko"));

const output =
  "import type { MedicalFacility } from \"../types\";\n\n" +
  "// data/raw/hwaseong_hospitals.csv에서 생성했습니다.\n" +
  "// 좌표는 주소의 읍/면/동 중심점 기준 임시 좌표이며, 지도/주소 API 연동 시 보강합니다.\n" +
  "export const generatedHospitals = " +
  JSON.stringify(hospitals, null, 2) +
  " satisfies MedicalFacility[];\n";

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

console.log("Generated " + hospitals.length + " hospitals -> " + path.relative(root, outputPath));
