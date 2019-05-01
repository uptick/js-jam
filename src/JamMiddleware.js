import {Middleware} from 'js-tinyapi'

export default class JamMiddleware extends Middleware {

  constructor(options) {
    super()
    this.schema = options.schema
  }

  postProcess = (api, response, options) => {
    const ct = response.response.headers['Content-Type'] || ''
    if (ct.startsWith('application/vnd.api+json')) {
      response.data = this.schema.fromJsonApi(response.data)
      console.debug('JamMiddleware incoming conversion: ', response.data)
    }
    return response.data
  }

}
