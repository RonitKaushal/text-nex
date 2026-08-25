import { Button, Divider, Dropdown, Flex, Modal, Space, Input } from 'antd'
import { useEffect, useRef, useState } from 'react'
import {
  BoldOutlined,
  ItalicOutlined,
  SmileOutlined,
  StrikethroughOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import emojiData from '@emoji-mart/data'
import EmojiPicker from './EmojiPicker'

const { TextArea } = Input

const TextEditor = ({ initialValue, onChange }) => {
  const [text, setText] = useState(initialValue)
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (initialValue !== text) {
      setText(initialValue)
    }
  }, [initialValue])

  function replaceRange(originalString, replacement, start, end) {
    return originalString.slice(0, start) + replacement + originalString.slice(end)
  }

  const getSelectionRange = () => {
    const el =
      textareaRef.current?.resizableTextArea?.textArea ||
      textareaRef.current?.input ||
      textareaRef.current

    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      return { start: el.selectionStart, end: el.selectionEnd }
    }

    return { start: text.length, end: text.length }
  }

  const modifyText = (preffix, suffix, replace, filter) => {
    const plainText = text || ''

    const { start, end } = getSelectionRange()
    const startIndex = start ?? 0
    const endIndex = end ?? 0

    const selectedText = plainText.slice(startIndex, endIndex)
    let replaceText = ''

    if (filter === 'bulleted-list' || filter === 'quote') {
      const lines = selectedText.split('\n')
      replaceText = lines
        .map((line) => {
          if (line.startsWith(preffix)) {
            return `${line.slice(preffix.length)}`
          } else {
            return `${preffix}${line}`
          }
        })
        .join('\n')
    } else {
      if (selectedText[0] === preffix && selectedText[selectedText.length - 1] === suffix) {
        replaceText = selectedText.replaceAll(preffix, '').replaceAll(suffix, '')
      } else {
        replaceText = `${preffix}${replace ?? selectedText}${suffix}`
      }
    }

    const newText = replaceRange(plainText, replaceText, startIndex, endIndex)
    setText(newText)
    if (onChange) onChange(newText)
  }

  const onBoldText = () => {
    modifyText('*', '*')
  }

  const onItalicText = () => {
    modifyText('_', '_')
  }

  const onMonospaceText = () => {
    modifyText('```', '```')
  }

  const onStrikeText = () => {
    modifyText('~', '~')
  }

  const onBulletList = () => {
    modifyText('- ', '', null, 'bulleted-list')
  }

  const onQuote = () => {
    modifyText('> ', '', null, 'quote')
  }

  const onInlineCode = () => {
    modifyText('`', '`')
  }

  const onEmojiText = (value) => {
    modifyText('', '', value.native)
    setShowEmoji(false)
  }

  const handleChangeText = (e) => {
    const value = e.target.value
    setText(value)
    if (onChange) onChange(value)
  }

  return (
    <>
      <Modal
        width={600}
        footer={null}
        closable={false}
        title={null}
        open={showEmoji}
        onCancel={() => setShowEmoji(false)}
      >
        <Flex justify="center">
          <EmojiPicker
            theme="light"
            autoFocus
            data={emojiData}
            perLine={15}
            centered
            onEmojiSelect={(emoji) => onEmojiText(emoji)}
          />
        </Flex>
      </Modal>

      <div className="text-editor-toolbar">
        <Space
          direction="horizontal"
          style={{
            width: '100%'
          }}
          size={5}
          wrap
          split={<Divider style={{ padding: 0, margin: 0 }} type="vertical" />}
        >
          <Dropdown
            menu={{
              items: [
                { key: 'name', label: 'name' },
                { key: 'number', label: 'number' }
              ],
              onClick: ({ key }) => modifyText('{{', '}}', key)
            }}
            placement="bottomRight"
            arrow
          >
            <Button style={{ padding: 0 }} size="small">
              useColumn
            </Button>
          </Dropdown>
          <SmileOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => setShowEmoji(true)} />
          <BoldOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={onBoldText} />
          <ItalicOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={onItalicText} />
          <StrikethroughOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={onStrikeText} />
          <UnorderedListOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={onBulletList} />
          <Button size="small" style={{ padding: 0 }} onClick={onQuote}>
            quote
          </Button>
          <Button size="small" style={{ padding: 0 }} onClick={onMonospaceText}>
            monospace
          </Button>
          <Button size="small" onClick={onInlineCode}>
            inlineCode
          </Button>
        </Space>
      </div>

      <TextArea
        ref={textareaRef}
        rows={6}
        value={text}
        onChange={handleChangeText}
        placeholder="Description"
        style={{ background: '#122033', borderColor: '#333', color: '#fff', marginTop: 6 }}
      />
    </>
  )
}

export default TextEditor
