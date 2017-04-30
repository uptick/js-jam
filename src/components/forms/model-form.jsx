import React, {Component} from 'react'

function capitalize( string ) {
  if( string === undefined ) {
    return
  }
  return string.charAt(0).toUpperCase() + string.slice(1)
}

class ModelForm extends Component {

  renderField( fieldName, model ) {
    const {typeMapping, fieldProps={}, instance={}, onChange, db} = this.props
    const field = model.getField( fieldName )
    let type, value = instance[fieldName]
    const isFK = model.fieldIsForeignKey( fieldName )
    if( isFK ) {
      type = 'foreignkey'
      if( value ) {
        value = db.get( value )
      }
    }
    else {
      type = field.get( 'type' )
    }
    const cls = typeMapping[type]
    if( cls === undefined )
      throw new Error( `no ModelForm field mapping for type ${type}` )
    const props = fieldProps[fieldName] || {}
    return React.createElement(
      cls,
      {
        default: field.get( 'default' ),
        name: fieldName,
        label: capitalize( field.get( 'label' ) ),
        value,
        onChange: x => {
          if( isFK && x ) {
            db.loadObjects( x )
          }
          instance[fieldName] = x
          instance.save()
          if( onChange )
            onChange()
        },
        key: fieldName,
        ...props
      }
    )
  }

  render() {
    const {schema, model: modelType} = this.props
    let {fields} = this.props
    const model = schema.getModel( modelType )
    if( fields === undefined ) {
      fields = []
      for( const f of model.iterFields() ) {
        if( f == 'id' || f == '_type' ) {
          continue
        }
        fields.push( f )
      }
    }
    return (
      <form>
        {fields.map( name =>
          this.renderField( name, model )
         )}
      </form>
    )
  }
}

export default ModelForm
