import React, {Component} from 'react'

class Spinner extends Component {
  render() {
    const {color='#000', scale=1} = this.props
    const w = scale * 40, h = scale * 40
    return (
      <svg version="1.1" id="loader-1" x="0px" y="0px" width={`${w}px`} height={`${h}px`} viewBox="0 0 50 50" style={{enableBackground: 'new 0 0 50 50'}}>
        <path fill={color} d="M43.935,25.145c0-10.318-8.364-18.683-18.683-18.683c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615c8.072,0,14.615,6.543,14.615,14.615H43.935z">
          <animateTransform attributeType="xml"
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="0.6s"
            repeatCount="indefinite"/>
        </path>
      </svg>
    )
  }
}

export default Spinner
