import ChanceJS from "chance";

export function generateEmailWithTag() {
  // Randomly generating the tag...
  const chance = new ChanceJS();
  const tag = chance.string({
    length: 12,
    pool: "abcdefghijklmnopqrstuvwxyz0123456789",
  });
  return `kelg8.${tag}@inbox.testmail.app`;
}

export function delay(time: number | undefined) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
