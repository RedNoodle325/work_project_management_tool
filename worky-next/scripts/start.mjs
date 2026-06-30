// Railway routes traffic to the port it assigns on every container interface.
// Do not inherit a container hostname that can make Next bind too narrowly.
process.env.HOSTNAME = '0.0.0.0'

await import('../.next/standalone/server.js')
