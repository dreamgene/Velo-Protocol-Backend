# Velo Protocol — Backend

Backend services and SDK for Velo Protocol, a USDC payment platform on the Stellar network.

## Structure

- `velo-backend/` — NestJS API service, database migrations, and settlement reconciler
- `velo-sdk/` — `@velo-protocol/pay` SDK and embeddable payment widget
- `docs/` — launch runbook and legal documents
- `scripts/` — operational scripts (pre-launch audit, etc.)

## Development

```bash
npm install
docker-compose up -d postgres redis

npm run dev      # turbo run dev across workspaces
npm run build
npm run test
npm run lint

npm run migrate   # run DB migrations (velo-backend)
```

## Related repos

- [Velo-Protocol-Contract](https://github.com/dreamgene/Velo-Protocol-Contract)
- [Velo-Protocol-FrontEnd](https://github.com/dreamgene/Velo-Protocol-FrontEnd)

## License

MIT — see [LICENSE](LICENSE).
