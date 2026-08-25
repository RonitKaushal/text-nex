import React, { useEffect, useRef } from 'react'
import { Picker } from 'emoji-mart'

export default function EmojiPicker(props) {
  const ref = useRef(null)
  const instance = useRef(null)

  if (instance.current) {
    instance.current.update(props)
  }

  useEffect(() => {
    instance.current = new Picker({ ...props, ref })

    return () => {
      instance.current = null
    }
  }, [])

  // eslint-disable-next-line react/react-in-jsx-scope
  return React.createElement('div', { ref })
}

