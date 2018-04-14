import React from 'react'

import {renderField} from './field'

export default options => Inner =>
  class extends React.Component {

    constructor(props) {
      super(props)
      let db = props.db.copy()
      this.state = {
        ...this.initial(props, db)
      }
    }

    componentWillReceiveProps(nextProps) {
      if (this.state.db && !nextProps.db.equals(this.props.db)) {
        console.debug('Rebasing form.')
        let db = this.state.db.rebase(nextProps.db, this.state.offset)
        this.setState({
          db,
          offset: nextProps.db.getLocalDiffs().size
        })
      }
    }

    reset = callback => {
      console.debug('Resetting form.')
      this.setState(this.initial(this.props, this.props.db), callback)
    }

    save = options => {
      console.debug('Saving form.')
      let {db = this.state.db, ...opts} = options
      db = db.copy() // TODO: Get rid of this? Need it for the reset below maybe?
      if (!this.props.saveDB)
        throw new Error('Must be part of a view to use saveDB.')

      // Must use a callback here, as it's imperative we have cleared
      // the local form before trying to save.
      this.reset(() => this.props.saveDB({db, ...opts}))
    }

    mutateForm = callback => {
      const db = callback()
      if (db)
        this.setDB(db)
    }

    setDB = db => {
      this.setState({db})
    }

    handleChange = ({db}) => this.setDB(db)

    initial = (props, db) => {
      return {
        db,
        offset: db.getLocalDiffs().size,
        instanceId: props.instanceId || db.create2(options.type, options.defaults)
      }
    }

    render() {
      const {instanceId, db} = this.state
      const instance = db.getInstance(instanceId)
      const loading = this.props.loading || this.state.loading
      return (
        <Inner
          {...this.props}
          {...{instance, db, loading}}
          resetForm={this.reset}
          saveForm={this.save}
          mutateForm={this.mutateForm}
          renderField={(x = {}) => renderField({onChange: this.handleChange, ...x})}
        />
      )
    }

  }
