const fs = require('fs')
const path = require('path')
const needle = require('needle')
const WebSocketClient = require('websocket').client
const appDataDir = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')


// Get the list of visible servers and all the info about them that we need

function serverGet() {
	return new Promise((resolve, reject) => {
		needle.get('https://kessel-api.parsecgaming.com/hosts', { headers: { 'Authorization': 'Bearer ' + session } }, (err, resp, body) => {
			if (!err && (body || {}).data) {
				resolve(body.data)
			} else {
				console.log(err)
				console.log(resp.headers)
				console.log(body)
				reject(err || Error('Server Get: Unknown Error Occured'))
			}
		})
	})
}


// Perform Daemon commands

let conn

function connectWS() {
	return new Promise((resolve, reject) => {

		if (conn) {
			resolve()
			return
		}

		const client = new WebSocketClient({ closeTimeout: 30000 })
	 
		client.on('connectFailed', error => {
		    console.log('WebSocket Connection Error: ' + error.toString())
		})
		 
		client.on('connect', connection => {
		    console.log('WebSocket Client Connected')

		    connection.on('error', error => {
		        console.log('WebSocket Connection Error: ' + error.toString())
		    })

		    connection.on('close', () => {
		        console.log('WebSocket Connection Closed')
		        conn = false
		    })

		    conn = connection

		    resolve()
		})
		 
		client.connect('ws://127.0.0.1:5309/', null, 'https://parsecgaming.com')
	})
}

function command(args) {
	return new Promise((resolve, reject) => {
		connectWS().then(() => {
			function handleMsg(message) {
		        if (message.type === 'utf8') {
		            console.log("Received: '" + message.utf8Data + "'")
	            	conn.removeListener('message', handleMsg)
		            resolve(message.utf8Data) // we consider any first reply as successful
		        }
			}
		    conn.on('message', handleMsg)

		    console.log("Sending: '" + JSON.stringify(args) + "'")
	    	conn.sendUTF(JSON.stringify(args))
		})
	})
}

function connectServer(serverHost) {
    console.log('Fetching Servers')
    serverGet().then(hosts => {
	    let host

		if (!(hosts || []).length) {
			console.error('Parsec server list is empty')
			return
		}

	    // select server by predefined id
	    hosts.some(srv => {
	    	if (srv.name == serverHost) {
	    		host = srv
	    		return true
	    	}
	    })

	    if (!host) {
	    	console.error('Server could not be found')
	    	console.log('Server options are:')
	    	console.log(hosts)
	    	return
	    }

	    // Do the server-ey connect-ey work
	    const appClient = {
			'session_id': session,
			'x-function': 'app_client',
//			'server_build': host['build'] + '',
			'peer_id': host['peer_id'] + ''
		}

	    console.log('CMD.app_client')
    	command(appClient).then(() => {
		    console.log('Done')
    	})
    })

}

let session

const sessionExpire = 172800000

module.exports = {
	start: (opts = {}) => {
		let errors = 0

		if (!opts.email) {
			console.error('No email set in start options')
			errors++
		}

		if (!opts.password) {
			console.error('No password set in start options')
			errors++
		}

		if (!opts.host) {
			console.error('No host set in start options')
			errors++
		}

		if (errors) {
			console.error(errors + ' errors occured, stopping')
			return
		}

		console.log('Logging in')

		const sessionFile = path.join(appDataDir, 'parsec_session.private')

		function getSession() {
		    needle.post('https://parsecgaming.com/v1/auth', { email: opts.email, password: opts.password, expiration_type: 'long' }, (err, resp, body) => {
		    	if (!err && body && body.session_id) {
		    		console.log('loggin data:')
		    		console.log(body)
		    		session = body.session_id
					console.log('Writing Session ID from File')
		    		fs.writeFileSync(sessionFile, session)
					connectServer(opts.host)
		    	} else {
		    		console.log('Could Not Get Session ID from Server')
		    		console.log(resp.headers)
		    		console.log(body)
		    		console.error(err || Error('Start Session: Unknown Error'))
		    	}
		    })
		}

		if (fs.existsSync(sessionFile)) {
			const stats = fs.statSync(sessionFile)
			const mtime = new Date(stats.mtime).getTime()
			if (Date.now() - mtime > sessionExpire) {
				getSession()
			} else {
				console.log('Retrieving Session ID from File')
				session = fs.readFileSync(sessionFile).toString()
				connectServer(opts.host)
			}
		} else {
			getSession()
		}
	},
	stop: () => {
		command({'x-function': 'app_client_cancel'}).then(() => {})
	}
}
