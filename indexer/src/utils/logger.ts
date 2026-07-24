export const logger = {
  info: (msg: string, data?: object) => console.log(JSON.stringify({ level: 'info', msg, ...data, ts: new Date().toISOString() })),
  error: (msg: string, data?: object) => console.error(JSON.stringify({ level: 'error', msg, ...data, ts: new Date().toISOString() })),
  warn: (msg: string, data?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ...data, ts: new Date().toISOString() }))
}
