export const MICRO_USD_PER_USD = 1_000_000;
export const usdToMicroUsd = (usd:number):number => Math.round(usd * MICRO_USD_PER_USD);
export const microUsdToUsd = (microUsd:number):number => microUsd / MICRO_USD_PER_USD;
export const reserveMicroUsd = (estimatedUsd:number,safetyFactor:number):number => Math.ceil(usdToMicroUsd(estimatedUsd) * safetyFactor);
