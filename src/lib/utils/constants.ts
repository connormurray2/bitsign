export const BITSIGN_PROTOCOL_ID = 'bitsign'
export const PUSH_DROP_BASKET = 'bitsign-signatures'
export const CWI_PROTOCOL: [1, string] = [1, 'bitsign document signing']
export const BSV_EXPLORER_TX_URL = (process.env.NEXT_PUBLIC_BSV_EXPLORER ?? 'https://whatsonchain.com/tx').replace(/\/+$/, '')
export const WOC_API_BASE = process.env.WOC_API_BASE ?? 'https://api.whatsonchain.com/v1/bsv/main'
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
export const SUPPORTED_MIME_TYPES = ['application/pdf']
