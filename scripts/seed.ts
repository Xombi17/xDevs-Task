import { getDb } from "../src/lib/db";
import { seedDemo } from "../src/lib/seed";

const result = seedDemo(getDb());
if (result.created) {
  console.log("Seeded Website Redesign");
  console.log(`Review link: /review/${result.reviewToken}`);
} else {
  console.log("Already seeded");
}
