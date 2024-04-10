const snarkjs = require("snarkjs")
const commitment = {secret:"1234", nullifier:"1234", nullifierHash:"1234", commitment:"1234"}
window.addEventListener("DOMContentLoaded", () => {
    window.addEventListener('message', event => {
        const { num1, num2 } = event.data;
        const sum = num1 + num2;
        // Send the result back to React Native code
        window.ReactNativeWebView.postMessage(JSON.stringify(sum));
    });
});
// window.addEventListener('message', async(event) => {
//     const commitment = event.data;
//     // const sum = num1 + num2;
//     // const { proof, publicSignals } = await snarkjs.groth16.fullProve(
//     //     {
//     //         nullifier: commitment.nullifier, secret: commitment.secret,
//     //         pathElements: [0,1 ], pathIndices: [0,1]
//     //     },
//     //     getVerifierWASM(),
//     //     "keys/Verifier.zkey"
//     // )
//     // Send the result back to React Native code
//     window.ReactNativeWebView.postMessage(JSON.stringify(commitment));
// });