import Model from './model'
import {flattenJsonApiResponse, renderJsonApi} from './jsonapi'

export default class Schema {

  static isSchema(value) {
    return value instanceof Schema
  }

  constructor(descr = {}) {
    this.models = {}
    this.merge(descr)
  }

  merge(descr = {}) {
    for(const type of Object.keys(descr)) {
      let model = this.models[type]
      if (!model) {
        model = new Model(type, descr[type])
        this.models[type] = model
      }
    }
  }

  getModel(type) {
    const model = this.models[type]
    if (!model) {
      throw Error(`Unknown model "${type}", options are: ${Object.keys(this.models).join(', ')}`)
    }
    return model
  }

  fromJsonApi(response) {
    return flattenJsonApiResponse(this, response)
  }

  toJsonApi(data, type) {
    if (!!type) {
      data._type = type
    }
    return renderJsonApi(this, data)
  }

}
