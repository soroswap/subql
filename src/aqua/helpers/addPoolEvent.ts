import { hexToSorobanAddress } from './utils';

// Helper function para extraer valores del evento add_pool
export function extractAddPoolAquaValues(event: any): {
    address: string;
    tokenA: string;
    tokenB: string;
    poolType: string;
} {
    let result = {
        address: '',
        tokenA: '',
        tokenB: '',
        poolType: ''
    };

    try {
        // Extraer user del value
        const values = event?.value?._value;
        if (!Array.isArray(values)) {
            throw new Error('No values array found in AddPool event');
        }

        logger.info("\n🔄 Processing Aqua AddPool event values:");

        // User address (primer valor del value)
        const userBuffer = values[0]?._value?._value?.data;
        if (userBuffer) {
            result.address = hexToSorobanAddress(Buffer.from(userBuffer).toString('hex'));
            logger.info(`→ User address: ${result.address}`);
        }
        // pool type
        const poolType = values[1]?._value?.data;
        if (poolType) {
            result.poolType = Buffer.from(poolType).toString('utf8');
            logger.info(`→ Pool type: ${result.poolType}`);
        }

        // Tokens del topic[1]
        const topicTokens = event?.topic?.[1]?._value;
        if (Array.isArray(topicTokens) && topicTokens.length >= 2) {
            // Token A
            const tokenABuffer = topicTokens[0]?._value?._value?.data;
            if (tokenABuffer) {
                result.tokenA = hexToSorobanAddress(Buffer.from(tokenABuffer).toString('hex'));
                logger.info(`→ Token A: ${result.tokenA}`);
            }

            // Token B
            const tokenBBuffer = topicTokens[1]?._value?._value?.data;
            if (tokenBBuffer) {
                result.tokenB = hexToSorobanAddress(Buffer.from(tokenBBuffer).toString('hex'));
                logger.info(`→ Token B: ${result.tokenB}`);
            }
        }

        if (!result.address || !result.tokenA || !result.tokenB) {
            throw new Error('Incomplete data in AddPool event');
        }

        return result;

    } catch (error) {
        logger.error(`❌ Error extracting Aqua AddPool values: ${error}`);
        logger.error('Event data was:', JSON.stringify(event, null, 2));
        throw error;
    }
}