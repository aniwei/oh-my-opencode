import React from 'react'

const Line = () => {
  return (
    <box 
      left={0}
      top={0}
      height="100%" 
      width={0.5} 
      style={{ fg: 'white', bg: 'blue' }} 
    />
  )
}

const TextInput = () => {
  return (
    <box 
      width="100%" 
      height={20} 
      style={{ fg: 'white', bg: 'black' }} 
    >
      <box top={0} left={1} content="Name:" />
      <textbox top={1} left={1} width="90%" height={1} inputOnFocus={true} />
    </box>
  )
}

const InputBox = () => {
  return (
    <box
      top="center"
      left="center"
      width="100%"
      height={4}
      style={{ fg: 'blue', bg: 'white' }}
    >
      <Line />
      <TextInput />
    </box>
  )
}

export const Home = () => {
  return (
    <box
      top={0}
      left={0}
      width="100%"
      height="100%"
      style={{ fg: 'green', bg: 'black' }}
    >
      <InputBox />
    </box>
  )
}