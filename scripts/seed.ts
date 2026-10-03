import { getDb } from "../src/lib/db";
import { seedDemo, seedTampered } from "../src/lib/seed";

const db = getDb();
const result = seedDemo(db);
if (result.created) {
  console.log("Seeded Website Redesign");
  console.log(`Review link: /review/${result.reviewToken}`);
} else {
  console.log("Already seeded");
}

const tampered = seedTampered(db);
console.log(tampered.created ? "Seeded Legacy Audit (tampered): Broken at entry #2" : "Already seeded");
