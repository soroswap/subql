import { toolkit } from "../toolkit";
import { soroswapRouter } from "./constants";
import { NETWORK } from "../../src/constants";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";

export async function getLatestRouterLedger(): Promise<any> {
  console.log("--------------------------------------------");
  console.log("Updating latest ledger for Soroswap");
  console.log("--------------------------------------------");
  let latestLedger = 0;
  try {
    latestLedger = (await toolkit.rpc.getLatestLedger()).sequence;

    let events;
    let startLedger = latestLedger - 50;
    const endLedger = latestLedger;

    let tries = 0;
    const maxTries = 20;

    do {
      console.log("startLedger:", startLedger);
      events = await toolkit.rpc.getEvents({
        startLedger,
        endLedger,
        filters: [
          {
            type: "contract",
            contractIds: [soroswapRouter[process.env.NETWORK as NETWORK]],
            topics: [["AAAADgAAAA5Tb3Jvc3dhcFJvdXRlcgAA", "AAAADwAAAARzd2Fw"]], // SoroswapRouter, swap in base64
          },
        ],
        limit: 100,
      });

      if (events.events.length > 0) {
        const latestLedgerWithEvent =
          events.events[events.events.length - 1].ledger;
        console.log("🚀 « latestLedgerWithEvent:", latestLedgerWithEvent);

        const startBlockFilePath = path.resolve(
          __dirname,
          "../../src/constants/startblock.json"
        );
    
        const dirPath = path.dirname(startBlockFilePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        let startBlockData = { startBlock: latestLedgerWithEvent };
        if (fs.existsSync(startBlockFilePath)) {
          try {
            const startBlockFileContent = fs.readFileSync(
              startBlockFilePath,
              "utf-8"
            );
            startBlockData = JSON.parse(startBlockFileContent);
            startBlockData.startBlock = latestLedgerWithEvent;
          } catch (error) {
            console.log("Error reading the startblock.json file, creating a new one:", error);
          }
        } else {
          console.log("The startblock.json file does not exist, creating a new one");
        }

        fs.writeFileSync(
          startBlockFilePath,
          JSON.stringify(startBlockData, null, 2),
          "utf-8"
        );

        break;
      } else {
        console.log("🚀 « No events found, retrying with 50 earlier ledgers");
        startLedger -= 50; // Subtract more to the startLedger
        tries++;
      }
    } while (events.events.length === 0 && startLedger > 0 && tries < maxTries);

    return startLedger;
  } catch (error) {
    console.log("🚀 « error:", error);
    return latestLedger;
  }
}
