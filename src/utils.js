export function isArray(x) {
  return Array.isArray(x)
}

export function makeId(type, id) {
  if (id === undefined) {
    return {_type: type.type, id: type.id}
  }
  else {
    return {_type: type, id}
  }
}

export function isIterable( x ) {
  if( x === null )
    return false
  return typeof x[Symbol.iterator] === 'function'
}

export function isObject( x ) {
  return typeof x === 'object' && x !== null
}

export function isNil(x) {
  return x === undefined || x === null
}

export function isEmpty(x) {
  return isNil(x) || x === ''
}

export function toArray( x ) {
  if( x instanceof Array )
    return x
  return [x]
}

export function toList( x ) {
  if( x instanceof Array )
    return new List( x )
  if( List.isList( x ) )
    return x
  return new List([ x ])
}

export function snakeToCamel(value) {
  return value.replace(/(\_\w)/g, match => match[1].toUpperCase())
}
