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

        const constantsFilePath = path.resolve(
          __dirname,
          "../../src/constants/soroswapContracts.ts"
        );
        const constantsFileContent = fs.readFileSync(
          constantsFilePath,
          "utf-8"
        );
        const network = process.env.NETWORK as NETWORK;
        const updatedContent = constantsFileContent.replace(
          new RegExp(`(${network}:\\s*{[^}]*startBlock:\\s*)\\d+(\\s*,)`),
          `$1${latestLedgerWithEvent}$2`
        );
        fs.writeFileSync(constantsFilePath, updatedContent, "utf-8");

        break;
      } else {
        console.log("🚀 « No events found, retrying with 50 earlier ledgers");
        startLedger -= 50; // Subtract more to the startLedger
      }
    } while (events.events.length === 0 && startLedger > 0);
  } catch (error) {
    console.log("🚀 « error:", error);
    return latestLedger;
  }
}
