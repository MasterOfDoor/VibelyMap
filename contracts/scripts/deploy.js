import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("🚀 Contract'ları deploy ediliyor...\n");

  // 1. Event Contract Deploy
  console.log("📝 Event Contract deploy ediliyor...");
  const EventContract = await hre.ethers.getContractFactory("EventContract");
  const eventContract = await EventContract.deploy();
  await eventContract.waitForDeployment();
  const eventAddress = await eventContract.getAddress();
  console.log("✅ Event Contract deployed to:", eventAddress);

  // 2. Review NFT Contract Deploy
  console.log("\n🎨 Review NFT Contract deploy ediliyor...");
  const ReviewNFT = await hre.ethers.getContractFactory("ReviewNFT");
  const reviewNFT = await ReviewNFT.deploy();
  await reviewNFT.waitForDeployment();
  const reviewAddress = await reviewNFT.getAddress();
  console.log("✅ Review NFT Contract deployed to:", reviewAddress);

  console.log("\n📋 DEPLOY SONUÇLARI:");
  console.log("==========================================");
  console.log("Event Contract Address:", eventAddress);
  console.log("Review NFT Address:", reviewAddress);
  console.log("==========================================\n");

  // Contract address'lerini dosyaya kaydet
  const addresses = {
    EventContract: eventAddress,
    ReviewNFT: reviewAddress,
    network: hre.network.name,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  
  console.log("✅ Address'ler 'deployed-addresses.json' dosyasına kaydedildi.\n");

  // Verify için bilgi
  console.log("🔍 Contract'ları verify etmek için:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${eventAddress}`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${reviewAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

