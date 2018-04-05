import React from 'react'

const handleChange = (instance, name, options) => value => {
  const {
    checkbox = false,
    db = instance.db,
    onChange
  } = options
  if (value.target !== undefined)
    value = value.target[checkbox ? 'checked' : 'value']
  instance[name] = value
  instance.save(db)
  if (onChange)
    onChange({instance, name, value, db})
}

const renderField = options => {
  const {
    db,
    instance,
    name,
    Component,
    label = '',
    onChange,
    checkbox = false,
    componentProps = {}
  } = options
  let value = instance[name]
  if (value === null)
    value = ''
  let props = {
    name,
    label,
    value,
    onChange: handleChange(instance, name, {onChange, checkbox, db}),
    ...componentProps
  }
  return <Component {...props} />
}

export {
  renderField
}
