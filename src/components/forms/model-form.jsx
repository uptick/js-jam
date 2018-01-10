import React, {Component} from 'react'

function capitalize( string ) {
  if( string === undefined ) {
    return
  }
  return string.charAt(0).toUpperCase() + string.slice(1)
}

const renderField = ({instance, fieldName, component, onChange, props = {}}) => {
  const model = instance.getModel()
  const field = model.getField(fieldName)
  let value = instance[fieldName]
  const isFK = model.fieldIsForeignKey(fieldName)
  const label = field.get('label', fieldName)
  props = {
    default: field.get('default'),
    name: fieldName,
    label: capitalize(label),
    value,
    onChange: x => {
      if(isFK && x) {
        db.loadObjects(x)
      }
      instance[fieldName] = x
      instance.save()
      if(onChange)
        onChange()
    },
    key: fieldName,
    ...props
  }
  if( field.get('choices', undefined ) ) {
    props.options = field.get('choices').toJS()
    if( Array.isArray( props.options ) ) {
      props.options = props.options.map(v => ({
        value: v,
        label: capitalize( v )
      }))
    }
    else {
      props.options = Object.keys(props.options).map(v => ({
        value: v,
        label: props.options[v]
      }))
    }
  }
  return React.createElement(
    component,
    props
  )
}

class ModelForm extends Component {

  renderField( fieldName, model ) {
    const {typeMapping={}, nameMapping={}, fieldProps={}, instance={}, onChange, db} = this.props
    const field = model.getField( fieldName )
    let type, value = instance[fieldName]
    const isFK = model.fieldIsForeignKey( fieldName )
    if( isFK ) {
      type = 'foreignkey'
      if( value ) {
        value = db.get( value )
      }
    }
    else if( model.fieldIsManyToMany( fieldName ) ) {
      type = 'manytomany'
    }
    else {
      type = field.get( 'type' )
    }
    const cls = nameMapping[fieldName] || typeMapping[type]
    if( cls === undefined ) {
      let msg = `no ModelForm field mapping for type ${type}`
      console.warn(msg)
      return null
    }
    const label = field.get('label', fieldName)
    let props = {
      default: field.get( 'default' ),
      name: fieldName,
      label: capitalize( label ),
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
      ...(fieldProps[fieldName] || {})
    }
    if( field.get( 'choices', undefined ) ) {
      props.options = field.get( 'choices' ).toJS()
      props.options = Object.keys( props.options ).map( v => ({value: v, label: props.options[v]}) )
    }
    return React.createElement(
      cls,
      props
    )
  }

  render() {
    const {db, model: modelType, exclude = []} = this.props
    let {fields} = this.props
    const model = db.schema.getModel( modelType )
    if( fields === undefined ) {
      fields = []
      for( const f of model.iterFields({includeReverse: true}) ) {
        if( f == 'id' || f == '_type' || exclude.includes(f) ) {
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
export {
  renderField
}
