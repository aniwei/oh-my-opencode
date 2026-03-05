# @vitamin/sdk

Embeddable SDK for integrating the Vitamin Coding Agent into applications. Provides a `createVitaminAgent()` factory, streaming `AgentStream`, and JSON-RPC server/client for inter-process communication.

## Installation

```bash
pnpm add @vitamin/sdk
```

## Usage

```typescript
import { createVitaminAgent } from '@vitamin/sdk'

const agent = await createVitaminAgent({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  projectDir: process.cwd(),
})

const conversation = agent.createConversation()
const stream = conversation.send('Explain the auth module')

for await (const event of stream) {
  if (event.type === 'text') process.stdout.write(event.text)
}
```

## Key Exports

| Export | Description |
|--------|-------------|
| `createVitaminAgent` | Main factory for creating an embeddable agent |
| `createAgentStream`, `AgentStream` | Async iterable stream of agent events |
| `createRpcServer` | JSON-RPC server for inter-process hosting |
| `createRpcClient` | JSON-RPC client for inter-process connection |

## Types

`VitaminAgent`, `VitaminAgentOptions`, `VitaminAgentState`, `ConversationHandle`, `StreamEvent`, `AgentStream`, `RPCRequest`, `RPCResponse`, `RPCError`, `RPCServerOptions`, `RPCClientOptions`

## License

See [root README](../../README.md) for details.
