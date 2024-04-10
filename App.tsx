import React, { useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import {WebView} from "react-native-webview"
import HTML from "./public/test.html"
const MyWebView = () => {
  const webViewRef = useRef(null);
  const [cmt, setCmt] = useState({nullifier:"", commitment:"", nullifierHash: "", secret:""})
  const [proof, setProof] = useState({root:"", pathIndices:[], pathElements: []})

  // Function to handle messages received from WebView
  const handleMessage = (event) => {
    console.log("data:", event.nativeEvent.data)
    if(event.nativeEvent.data === undefined || event.nativeEvent.data === "data received:"){
      return
    }
    // return
    if(JSON.parse(event.nativeEvent.data).nullifier){
      const commitment = JSON.parse(event.nativeEvent.data)
      console.log('Commitment from WebView:', commitment);
      setCmt(commitment)

    } // commitment wont give error proof will
    else{
      console.log('Proof from WebView:', event.nativeEvent.data);
      setProof(JSON.parse(event.nativeEvent.data))
    }
  }

  const genProof = () => {
    console.log("proof button pressed", cmt)
      webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(cmt)}, "*");`);
      return 
  }
  const genCommitment = () => {
    console.log("button pressed")
    webViewRef.current.injectJavaScript(`window.postMessage("test", "*");`);
  }
  return (
    <View style={{ flex: 1 }}>
      <Text>Nullifier: {cmt.nullifier}</Text>
      <Text>commitment: {cmt.commitment}</Text>
      <Text>nullifierHash: {cmt.nullifierHash}</Text>
      <Text>secret: {cmt.secret}</Text>
      <Button title="Generate commitment" onPress={genCommitment}/>
      <Text>Root: {proof.root}</Text>
      <Text>Indices: {proof.pathIndices}</Text>
      <Text>Elements: {proof.pathElements}</Text>
      <Button title="Generate proof" onPress={genProof}/>
      <WebView
        ref={webViewRef}
        source={HTML} // URL of the server serving the HTML file
        onMessage={handleMessage}
      />
      <Text>Hello</Text>
    </View>
  );
};

export default MyWebView;
