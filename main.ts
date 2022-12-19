import * as http from 'http'
import * as url from 'url'
import { oraPromise } from 'ora'
import { ChatGPTAPIBrowser, ProgressResponse } from 'src'
import { v4 as uuidv4 } from 'uuid'
import yargs from 'yargs'

const args = yargs
  .option('email', {
    alias: 'e',
    description: 'email of openai account',
    type: 'string',
    demandOption: true
  })
  .option('password', {
    alias: 'pwd',
    description: 'password of openai account',
    type: 'string',
    demandOption: true
  })
  .option('port', {
    alias: 'p',
    description: 'port of server',
    type: 'number',
    demandOption: true
  }).argv

async function main() {
  const api = new ChatGPTAPIBrowser({
    email: args.email,
    password: args.password,
    debug: true,
    minimize: true
  })

  await api.initSession()

  let processing = true
  let ret = await oraPromise(api.sendMessage('hello'), {
    text: 'hello'
  })
  processing = false

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.writeHead(200)
    if (processing) {
      res.end(`AI猪还在计算上一个问题呢，请稍后再提问。`)
      return
    }

    processing = true
    const decoded_url = decodeURIComponent(req.url)
    const question = url.parse(decoded_url, true).path.slice(1)

    console.log(
      `---------------------- start handle question ${question} port ${args.port}) ----------------------`
    )

    try {
      ret = await oraPromise(
        api.sendMessage(question, {
          conversationId: ret.conversationId,
          parentMessageId: ret.messageId,
          timeoutMs: 2 * 60 * 1000,
          onProgress: (response: ProgressResponse) => {
            res.write(response.newData)
          }
        }),
        {
          text: question
        }
      )
      res.end()
      console.log(
        `---------------------- finish handle question ${question} port ${args.port} answer ${ret.response}) ----------------------`
      )
    } catch (err) {
      console.error(
        `---------------------- fail handle question ${question} port ${args.port} err ${err}) ----------------------`
      )
      console.error(err.stack)
    } finally {
      processing = false
    }
  })

  server.listen(args.port, () => {
    console.log(`Server listening on port ${args.port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
