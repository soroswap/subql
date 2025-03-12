import { SorobanEvent } from "@subql/types-stellar";

export const phoenixHandler = async (event: SorobanEvent) => {
  logger.info(`${event}`);
};
