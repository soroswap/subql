function extractDepositAquaValues(event: any): {
    user: string,
    tokenIn: string,
    tokenOut: string,
    inAmount: bigint,
    outMin: bigint
} {
    let result = {
        user: '',
        tokenIn: '',
        tokenOut: '',
        inAmount: BigInt(0),
        outMin: BigInt(0)
    };

    try {
        const values = event?.value?._value;
        if (!Array.isArray(values)) {
            logger.error('❌ Event structure is not as expected. Event value:', JSON.stringify(event?.value));
            throw new Error('No values array found in Deposit event');
        }

        logger.info("\n🔄 Processing Aqua Deposit event values:");

        // Los primeros valores son direcciones (user y tokens)
        if (values.length >= 2) {
            // User address (primer valor)
            const userBuffer = values[0]?._arm === 'address' ? 
                values[0]?._value?._value?._value?.data : null;
            if (userBuffer) {
                result.user = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
                logger.info(`→ User address: ${result.user}`);
            }

            // Tokens (segundo valor es un vector de addresses)
            const tokens = values[1]?._value;
            if (Array.isArray(tokens) && tokens.length >= 2) {
                // Token In (primer token)
                const tokenInBuffer = tokens[0]?._value?._value?._value?.data;
                if (tokenInBuffer) {
                    result.tokenIn = hexToSorobanAddress(Buffer.from(tokenInBuffer).toString('hex'));
                    logger.info(`→ Token In: ${result.tokenIn}`);
                }

                // Token Out (segundo token)
                const tokenOutBuffer = tokens[1]?._value?._value?._value?.data;
                if (tokenOutBuffer) {
                    result.tokenOut = hexToSorobanAddress(Buffer.from(tokenOutBuffer).toString('hex'));
                    logger.info(`→ Token Out: ${result.tokenOut}`);
                }
            }

            // Desired amounts (cuarto valor es un vector de u128)
            const desiredAmounts = values[3]?._value;
            if (Array.isArray(desiredAmounts) && desiredAmounts.length >= 1) {
                const inAmount = desiredAmounts[0]?._value?._attributes?.lo?._value;
                if (inAmount) {
                    result.inAmount = BigInt(inAmount);
                    logger.info(`→ In Amount: ${result.inAmount.toString()}`);
                }
            }

            // Min shares (quinto valor)
            const minShares = values[4]?._value?._attributes?.lo?._value;
            if (minShares) {
                result.outMin = BigInt(minShares);
                logger.info(`→ Min Shares: ${result.outMin.toString()}`);
            }
        }

        // Verificación más flexible
        if (!result.user || !result.tokenIn || !result.tokenOut) {
            throw new Error('No data could be extracted from the Deposit event');
        }

        return result;

    } catch (error) {
        logger.error(`❌ Error extracting Aqua Deposit values: ${error}`);
        logger.error('Event data was:', JSON.stringify(event, null, 2));
        throw error;
    }
}
