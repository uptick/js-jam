import React from 'react'

export default options => Inner =>
  class extends React.Component {

    constructor(props) {
      super(props)
      let db = props.db.copy()
      this.state = {
        db,
        ...this.initial(props, db)
      }
    }

    reset = () => {
      this.setState(this.initial(this.props, this.state.db))
    }

    mutateForm = callback => {
      const db = callback()
      if (db)
        this.setDB(db)
    }

    setDB = db => {
      this.setState({db})
    }

    initial = (props, db) => {
      return {
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
          mutateForm={this.mutateForm}
        />
      )
    }

  }
