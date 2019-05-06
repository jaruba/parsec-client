# Parsec Client - For Parsec Gaming API

## Usage

```
const parsecClient = require('parsec-client')

parsecClient.start({
	email: 'my-parsec-email',
	password: 'my-parsec-password',
	host: 'parsec-server-hostname' // that you want to connect to
})

setTimeout(() => {
	parsecClient.stop()
}, 10000) // stop the client connection after 10 seconds
```

Parsec Gaming daemon needs to be running for this to work.

If you do not know the hostname of the parsec server you want to connect to, you can write any string there and will get an error and the list of all available servers.
