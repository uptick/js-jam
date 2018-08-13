import {snakeToCamel} from './utils'

/**
 * Flatten a single JsonApi resource.
 */
export function flattenJsonApiResource(schema, resource, table = {}) {
  if (resource.type === undefined) {
    console.warning(
      'Unable to process JSON-API as a resource. Please consider changing the content-type.'
    )
    return data
  }
  const tableKey = `${resource.type}|${resource.id}`
  const data = table[tableKey] || {}
  data._type = resource.type
  data.id = resource.id
  const model = schema.getModel(data._type)
  for (const [name, value] of Object.entries(resource.attributes || {})) {
    data[snakeToCamel(name)] = model.fieldToInternal(name, value)
  }
  for (const [name, value] of Object.entries(resource.relationships || {})) {
    data[snakeToCamel(name)] = flattenJsonApiData(schema, value.data, table)
  }
  table[tableKey] = data
  return data
}

/**
 * Flatten a JsonApi data item or array.
 */
export function flattenJsonApiData(schema, data, table = {}) {
  if (data) {
    let many
    if (Array.isArray(data)) {
      many = true
    } else {
      many = false
      data = [data]
    }
    data = data.map(d => flattenJsonApiResource(schema, d, table))
    if (!many) {
      data = data[0]
    }
  }
  return data
}

/**
 * Flatten a JsonApi response.
 */
export function flattenJsonApiResponse(schema, response) {
  const table = {}
  flattenJsonApiData(schema, response.included, table)
  return flattenJsonApiData(schema, response.data, table)
}

export function renderJsonApi(schema, data) {
  if (data) {
    let many
    if (Array.isArray(data)) {
      many = true
    } else {
      many = false
      data = [data]
    }
    data = data.map(d => {
      const model = schema.getModel(d._type)
      return model.toJsonApi(d)
    })
    if (!many) {
      data = data[0]
    }
  }
  return {data}
}
