import moment from 'moment'

import {isArray, isNil, isEmpty, makeId, lower} from './utils'

export default class Field {

  equals(a, b) {
    return a == b
  }

  toInternal(value) {
    if (isNil(value)) {
      return null
    }
    return this._toInternal(value)
  }

  fromInternal(value) {
    if (isNil(value)) {
      return null
    }
    return this._fromInternal(value)
  }

  _toInternal(value) {
    return value
  }

  _fromInternal(value) {
    return value
  }

  diff(from, to) {
    if (this.equals(from, to)) {
      return null
    }
    return this._diff(from, to)
  }

  _diff(from, to) {
    return to
  }

}

class NonTextField extends Field {

  toInternal(value) {
    if (isEmpty(value)) {
      return null
    }
    return this._toInternal(value)
  }

  fromInternal(value) {
    if (isEmpty(value)) {
      return null
    }
    return this._fromInternal(value)
  }

}

class FloatField extends NonTextField {

  _toInternal(value) {
    return parseFloat(value)
  }

}

class BooleanField extends NonTextField {

  _toInternal(value, db) {
    return [true, 'true', 'TRUE', 1].includes(value)
  }

}

class TimestampField extends NonTextField {

  equals(a, b) {
    if (moment.isMoment(a)) {
      return a.isSame(b)
    }
    else if (moment.isMoment(b)) {
      return b.isSame(a)
    }
    return a == b
  }

  _toInternal(value) {
    return moment(value)
  }

  _fromInternal(value) {
    return value.toISOString()
  }

}

class DateField extends TimestampField {

  _fromInternal(value) {
    return value.format('YYYY-MM-DD')
  }

}

class ForeignKeyField extends NonTextField {

  equals(a, b) {
    if (isEmpty(a) || isEmpty(b)) {
      return a == b
    }
    return a._type == b._type && a.id == b.id
  }

  _toInternal(value) {
    return makeId(value.type, value.id)
  }

  _fromInternal(value) {
    return {
      type: value._type,
      id: value.id
    }
  }

}

class ManyToManyField extends ForeignKeyField {

  equals(a, b) {
    if (!isArray(a) || !isArray(b)) {
      return a == b
    }
    else if (a.length != b.length) {
      return false
    }
    else {
      for (let ii = 0; ii < a.length; ++ii) {
        if (!super.equals(a[ii], b[ii])) {
          return false
        }
      }
      return true
    }
  }

  toInternal(value) {
    if (isEmpty(value)) {
      value = []
    }
    return value.map(x => super._toInternal(x)).filter(x => x !== null)
  }

  fromInternal(value) {
    if (isEmpty(value)) {
      return []
    }
    return value.map(x => super._fromInternal(x))
  }

  _diff(from, to) {
    const fromSet = new Set(from.map(x => `${x._type}|${x.id}`))
    const toSet = new Set(to.map(x => `${x._type}|${x.id}`))
    return [
      from.filter(x => !toSet.has(`${x._type}|${x.id}`)),
      to.filter(x => !fromSet.has(`${x._type}|${x.id}`))
    ]
  }

}

let fields = {
  integer: new NonTextField(),
  float: new FloatField(),
  double: new FloatField(),
  decimal: new FloatField(),
  timestamp: new TimestampField(),
  datetime: new TimestampField(),
  date: new DateField(),
  boolean: new BooleanField(),
  enum: new NonTextField(),
  foreignkey: new ForeignKeyField(),
  manytomany: new ManyToManyField()
}

let unknownField = new Field()

Field.equals = function(type, a, b) {
  const fld = fields[lower(type)]
  return fld ? fld.equals(a, b) : unknownField.equals(a, b)
}

Field.toInternal = function(type, value) {
  const fld = fields[lower(type)]
  return fld ? fld.toInternal(value) : unknownField.toInternal(value)
}

Field.fromInternal = function(type, value) {
  const fld = fields[lower(type)]
  return fld ? fld.fromInternal(value) : unknownField.fromInternal(value)
}

Field.diff = function(type, from, to) {
  const fld = fields[lower(type)]
  return fld ? fld.diff(from, to) : unknownField.diff(from, to)
}

export {
  fields,
  TimestampField,
  BooleanField,
  ForeignKeyField,
  ManyToManyField
}
