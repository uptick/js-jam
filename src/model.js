import {makeId, snakeToCamel} from './utils'
import Field from './field'

export default class Model {

  constructor(type, options = {}) {
    this.type = type
    this.idField = options.idField || 'id'
    this.attributes = options.attributes || {}
    this.relationships = options.relationships || {}
  }

  toJsonApi(data = {}) {
    return {
      id: data.id,
      type: this.type,
      attributes: this.attributesToJsonApi(data),
      relationships: this.relationshipsToJsonApi(data)
    }
  }

  attributesToJsonApi(data) {
    const attrs = {}
    for (const name of Object.keys(this.attributes)) {
      const value = data[snakeToCamel(name)]
      if (value !== undefined) {
        attrs[name] = this.fieldFromInternal(name, value)
      }
    }
    return attrs
  }

  relationshipsToJsonApi(data) {
    const rels = {}
    for (const name of Object.keys(this.relationships)) {
      const value = data[snakeToCamel(name)]
      if (value !== undefined) {
        rels[name] = {
          data: this.fieldFromInternal(name, value)
        }
      }
    }
    return rels
  }

  toInternal(data = {}) {
    let object = makeId(this.type, this.fieldToInternal('id', data.id))
    for (const [name, value] of Object.entries(data)) {
      object[name] = this.fieldToInternal(name, value)
    }
    return object
  }

  fromInternal(object = {}) {
    let data = {
      type: this.type,
      id: object.id
    }
    for (const [name, value] of Object.entries(object)) {
      this.switchOnField(name, {
        attribute: function(field) {
          data[name] = Field.fromInternal(field.type, value)
        },
        foreignKey: function(field) {
          data[name] = Field.fromInternal('foreignkey', value)
        },
        manyToMany: function(field) {
          data[name] = Field.fromInternal('manytomany', value)
        }
      })
    }
    return data
  }

  fieldToInternal(name, value) {
    return this._fieldOp(name, type => {
      if (type == 'id') {
        return value
      }
      else {
        return Field.toInternal(type, value)
      }
    }, value)
  }

  fieldFromInternal(name, value) {
    return this._fieldOp(name, type => {
      if (type == 'id') {
        return value
      }
      else {
        return Field.fromInternal(type, value)
      }
    }, value)
  }

  fieldEquals(name, a, b) {
    return this._fieldOp(name, type => Field.equals(type, a, b))
  }

  isAttribute(name) {
    return name in this.attributes
  }

  isForeignKey(name) {
    const info = this.relationships[name]
    if (!info) {
      return false
    }
    return !info.many
  }

  isManyToMany(name) {
    const info = this.relationships[name]
    if (!info) {
      return false
    }
    return info.many
  }

  isRelationship(name) {
    return name in this.relationships
  }

  getField(name) {
    let field = this.attributes[name]
    if (!field) {
      field = this.relationships[name]
    }
    return field
  }

  getFieldType(name) {
    const field = this.getField(name)
    if (this.fieldIsAttribute(name)) {
      return field.type
    }
    else {
      return field.many ? 'manyToMany' : 'foreignKey'
    }
  }

  /* diff(fromObj, toObj) {
   *   let diff = {}

   *   // Check for creation.
   *   if (isEmpty(fromObj)) {
   *     if (isEmpty(toObj))
   *       return null
   *     for (const name of this.iterFields()) {
   *       if (toObj[name] !== undefined) {
   *         diff[name] = [null, toObj[name]]
   *       }
   *     }
   *   }

   *   // Check for remove.
   *   else if (isEmpty(toObj)) {
   *     for (const field of this.iterFields()) {
   *       if (fromObj[field] !== undefined) {
   *         diff[field] = [fromObj[field], null]
   *       }
   *     }
   *   }

   *   // Use field differences.
   *   else {
   *     for (const name of this.iterFields()) {
   *       const f = fromObj[name]
   *       const t = toObj[name]
   *       let d
   *       this.switchOnField(name, {
   *         attribute: fld => {
   *           d = Field.diff(fld.get('type'), f, t)
   *         },
   *         foreignKey: fld => {
   *           d = Field.diff('foreignkey', f, t)
   *         },
   *         manyToMany: fld => {
   *           d = Field.diff('manytomany', f, t)
   *         }
   *       })
   *       if (d) {
   *         diff[name] = d
   *       }
   *     }
   *     if (Object.keys(diff).length) {
   *       diff._type = [fromObj._type, toObj._type]
   *       diff.id = [fromObj.id, toObj.id]
   *     }
   *   }

   *   return Object.keys(diff).length ? diff : null
   * }

   * diffToJsonApi(diff, db) {
   *   let data = {
   *     type: diff._type[1],
   *     id: db.unmapID(diff._type[1], diff.id[1]),
   *     attributes: {},
   *     relationships: {}
   *   }
   *   const op = getDiffOp(diff)
   *   if (op == 'remove') {
   *     data.type = diff._type[0]
   *     data.id = db.unmapID(data.type, diff.id[0])
   *   }
   *   for (const name of this.iterAttributes()) {
   *     if (name in diff) {
   *       const fld = this.getField(name)
   *       data.attributes[name] = Field.fromInternal(fld.get('type'), diff[name][1], db)
   *     }
   *   }
   *   for (const name of this.iterForeignKeys()) {
   *     if (name in diff) {
   *       const v = diff[name][1]
   *       data.relationships[name] = {
   *         data: v ? {type: v._type, id: db.unmapID(v._type, v.id)} : null
   *       }
   *     }
   *   }
   *   return {data}
   * } */

  switchOnField(field, ops) {
    let call
    let info
    if (field == this.idField) {
      call = ops.id
    }
    else {
      info = this.relationships[field]
      if (info !== undefined) {
        if (info.many) {
          call = ops.manyToMany
        }
        else {
          call = ops.foreignKey
        }
      }
      else {
        info = this.attributes[field]
        if (info !== undefined) {
          call = ops.attribute
        }
      }
    }
    if (call) {
      call(info)
    }
  }

  _fieldOp(name, callback, defaultValue) {
    let r = defaultValue
    this.switchOnField(name, {
      id: function(fld) {
        r = callback('id')
      },
      attribute: function(fld) {
        r = callback(fld.type)
      },
      foreignKey: function(fld) {
        r = callback('foreignkey')
      },
      manyToMany: function(fld) {
        r = callback('manytomany')
      }
    })
    return r
  }

}
