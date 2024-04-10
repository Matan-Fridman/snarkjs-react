const { buildMimcSponge } = require("circomlibjs")
const { BigNumber } = require("ethers")
// const crypto = require("crypto")
// const fs = require("fs")
const ethers = require("ethers")
const {MerkleTree} = require("merkletreejs")
const snarkjs = require("snarkjs")
const loadWebAssembly = require("./Verifier");
// const { Storage} = require("@google-cloud/storage")
const randomBytes = require("random-bytes")

module.exports = {generateCommitment, addCommitment, generateAndVerifyProof, getFileNames}
async function generateCommitment() {
    const mimc = await buildMimcSponge();
    const nullifier = ethers.toBigInt(randomBytes.sync(31)).toString();
    const secret = ethers.toBigInt(randomBytes.sync(31)).toString();
    const commitment = mimc.F.toString(mimc.multiHash([nullifier, secret]));
    const nullifierHash = mimc.F.toString(mimc.multiHash([nullifier]));
    return {
        nullifier: nullifier,
        secret: secret,
        commitment: commitment,
        nullifierHash: nullifierHash
    };
}
async function addCommitment(preMadeCommitments = undefined) {
    let commitment = undefined
    if(preMadeCommitments){ // add commitments from bucket to loacl rep
        const storage = new Storage()
        for(const cmt of preMadeCommitments){
            await fs.promises.appendFile("google-cloud-downloads/merkle-tree-commitments", `, ${cmt}`, "utf-8")
            await storage.bucket("matan-testing-bucket").file(cmt).delete()
        }
    }
    else{   // generate and add commitment locally
        commitment = await generateCommitment();
        await fs.promises.appendFile("google-cloud-downloads/merkle-tree-commitments", `, ${commitment.commitment}`, "utf-8")
    }
    const mimc = await buildMimcSponge()

    const commitmentData = await fs.promises.readFile("google-cloud-downloads/merkle-tree-commitments", "utf-8")
    const commitments = commitmentData.split(', ');

    const roots = (await fs.promises.readFile("google-cloud-downloads/merkle-tree-roots", "utf-8")).split(", ");  // get current elems
    await fs.promises.readFile("google-cloud-downloads/merkle-tree-commitments", "utf-8")
    const newRoot = calculateMerkleRootAndPath(mimc, commitments)  // calc root with new commitment
    roots.push(newRoot) // add new root to roots array

    if(roots.length>30){
      console.log("removing old root")
      roots.splice(0, 1)  // remove oldest root
    }
    try {
        // await fs.writeFile(downloadedFilePath, JSON.stringify(commitments), "utf-8");
        await fs.promises.writeFile("google-cloud-downloads/merkle-tree-roots", roots.join(", "), "utf-8");
    } catch (error) {
        console.error("Error writing file:", error);
        throw error;
    }
    console.log("successfully added commitment")
    if(commitment){
        return commitment
    }
    return;
}
const zeros = [
    '21663839004416932945382355908790599225266501822907911457504978515578255421292',
    '16923532097304556005972200564242292693309333953544141029519619077135960040221',
    '7833458610320835472520144237082236871909694928684820466656733259024982655488',
    '14506027710748750947258687001455876266559341618222612722926156490737302846427',
    '4766583705360062980279572762279781527342845808161105063909171241304075622345',
    '16640205414190175414380077665118269450294358858897019640557533278896634808665',
    '13024477302430254842915163302704885770955784224100349847438808884122720088412',
    '11345696205391376769769683860277269518617256738724086786512014734609753488820',
    '17235543131546745471991808272245772046758360534180976603221801364506032471936',
    '155962837046691114236524362966874066300454611955781275944230309195800494087',
    '14030416097908897320437553787826300082392928432242046897689557706485311282736',
    '12626316503845421241020584259526236205728737442715389902276517188414400172517',
    '6729873933803351171051407921027021443029157982378522227479748669930764447503',
    '12963910739953248305308691828220784129233893953613908022664851984069510335421',
    '8697310796973811813791996651816817650608143394255750603240183429036696711432',
    '9001816533475173848300051969191408053495003693097546138634479732228054209462',
    '13882856022500117449912597249521445907860641470008251408376408693167665584212',
    '6167697920744083294431071781953545901493956884412099107903554924846764168938',
    '16572499860108808790864031418434474032816278079272694833180094335573354127261',
    '11544818037702067293688063426012553693851444915243122674915303779243865603077',
    '18926336163373752588529320804722226672465218465546337267825102089394393880276'
]
function convertCallData(calldata) {
    const argv = calldata
        .replace(/["[\]\s]/g, "")
        .split(",")
        .map((x) => BigInt(x).toString());

    const a = [argv[0], argv[1]];
    const b = [
        [argv[2], argv[3]],
        [argv[4], argv[5]],
    ]
    const c = [argv[6], argv[7]]
    const input = [argv[8], argv[9]]

    return { a, b, c, input };
}
 function calculateMerkleRootAndPathFromTree(mimc, elements, element=undefined) {
    //   const zeros = generateZeros(mimc, 20);
    
      const treeHashFn = (values) =>{
          // console.log("values:", values)
          const val = values.map((e)=>e.toString("hex"))
          // console.log("val:", val)
          const hash = mimc.F.toString(mimc.multiHash(val))
          return hash
      }
      const elems = elements.map((e)=>e.toString())
      const tree = new MerkleTree(elems, treeHashFn, {
          concatenator: ((v) => {
              return v})
              ,
              fillDefaultHash:()=>{return ZERO_VALUE}
    })
      const layerAmount = tree.getLayerCount()
    
      const layers = tree.getHexLayers().map((layer)=>layer.map((leaf => leaf.substring(2)))) // get hex layers instead of buffers and remove '0x'
      for(let i = layerAmount - 1; i<20;i++){
          const hash = treeHashFn([layers[i][0], zeros[i]])  // start at root and hash with the corresponding zero
          layers.push([hash]) // add layer to layers
      }
      
      const root = layers[layers.length-1][0]
      
      let pathElements = []
      let pathIndices = []
      
      if (element) {
        let index = layers[0].indexOf(element)
        console.log("index:", index)
    
        if(index === -1){
            return false
        }
        for (let level = 0; level < 20; level++) {
            pathIndices[level] = index % 2
            pathElements[level] = (index ^ 1) < layers[level].length ? layers[level][index ^ 1] : zeros[level]
            index >>= 1
        }
        console.log(root, pathElements, pathIndices)
        return {
            root: root,
            pathElements: pathElements,
            pathIndices: pathIndices
        }
      }
      return root
    }
     async function calculateMerkleRootAndPath(levels, elements, element=undefined) {
        const capacity = 2 ** levels
        if (elements.length > capacity) throw new Error('Tree is full')
        const mimc = await buildMimcSponge()
    
        let layers = []
        layers[0] = elements.slice()
        for (let level = 1; level <= levels; level++) {
            layers[level] = []
            for (let i = 0; i < Math.ceil(layers[level - 1].length / 2); i++) {
                layers[level][i] = mimc.F.toString(mimc.multiHash([
                    layers[level - 1][i * 2],
                    i * 2 + 1 < layers[level - 1].length ? layers[level - 1][i * 2 + 1] : zeros[level - 1]]))
            }
        }
        // console.log(layers)
        const root = layers[levels].length > 0 ? layers[levels][0] : zeros[levels - 1]
        console.log("root 1: ", root)
        let pathElements = []
        let pathIndices = []
    
        if (element) {
            // const bne = BigNumber.from(element)
            let index = layers[0].findIndex(e => e===element)
            console.log('idx: ' + index)
            if(index === -1){
                return false
            }
            for (let level = 0; level < levels; level++) {
                pathIndices[level] = index % 2
                pathElements[level] = (index ^ 1) < layers[level].length ? layers[level][index ^ 1] : zeros[level]
                index >>= 1
            }
        }
    
        return {
            root: root,
            pathElements: pathElements.map((v) => v.toString()),
            pathIndices: pathIndices.map((v) => v.toString())
        }
    }
// const zeros = [
//     '21663839004416932945382355908790599225266501822907911457504978515578255421292',
//     '16923532097304556005972200564242292693309333953544141029519619077135960040221',
//     '7833458610320835472520144237082236871909694928684820466656733259024982655488',
//     '14506027710748750947258687001455876266559341618222612722926156490737302846427',
//     '4766583705360062980279572762279781527342845808161105063909171241304075622345',
//     '16640205414190175414380077665118269450294358858897019640557533278896634808665',
//     '13024477302430254842915163302704885770955784224100349847438808884122720088412',
//     '11345696205391376769769683860277269518617256738724086786512014734609753488820',
//     '17235543131546745471991808272245772046758360534180976603221801364506032471936',
//     '155962837046691114236524362966874066300454611955781275944230309195800494087',
//     '14030416097908897320437553787826300082392928432242046897689557706485311282736',
//     '12626316503845421241020584259526236205728737442715389902276517188414400172517',
//     '6729873933803351171051407921027021443029157982378522227479748669930764447503',
//     '12963910739953248305308691828220784129233893953613908022664851984069510335421',
//     '8697310796973811813791996651816817650608143394255750603240183429036696711432',
//     '9001816533475173848300051969191408053495003693097546138634479732228054209462',
//     '13882856022500117449912597249521445907860641470008251408376408693167665584212',
//     '6167697920744083294431071781953545901493956884412099107903554924846764168938',
//     '16572499860108808790864031418434474032816278079272694833180094335573354127261',
//     '11544818037702067293688063426012553693851444915243122674915303779243865603077',
//     '18926336163373752588529320804722226672465218465546337267825102089394393880276'
// ]
async function calculateMerkleRootAndPath(levels, elements, element = undefined) {
    const capacity = 2 ** levels
    if (elements.length > capacity) throw new Error('Tree is full')
    const mimc = await buildMimcSponge()

    let layers = []
    layers[0] = elements.slice()
    for (let level = 1; level <= levels; level++) {
        layers[level] = []
        for (let i = 0; i < Math.ceil(layers[level - 1].length / 2); i++) {
            layers[level][i] = mimc.F.toString(mimc.multiHash([
                layers[level - 1][i * 2],
                i * 2 + 1 < layers[level - 1].length ? layers[level - 1][i * 2 + 1] : zeros[level - 1]]))
        }
    }
    // console.log(layers)
    const root = layers[levels].length > 0 ? layers[levels][0] : zeros[levels - 1]
    console.log("root 1: ", root)
    let pathElements = []
    let pathIndices = []

    if (element) {
        let index = layers[0].findIndex(e => e === element)
        if (index === -1) {
            return false
        }
        console.log('idx: ' + index)
        for (let level = 0; level < levels; level++) {
            pathIndices[level] = index % 2
            pathElements[level] = (index ^ 1) < layers[level].length ? layers[level][index ^ 1] : zeros[level]
            index >>= 1
        }
        return {
            root: root,
            pathElements: pathElements.map((v) => v.toString()),
            pathIndices: pathIndices.map((v) => v.toString())
        }
    }
    return root
}
const ZERO_VALUE = '21663839004416932945382355908790599225266501822907911457504978515578255421292' // = keccak256("tornado") % FIELD_SIZE
async function generateAndVerifyProof(commitments, commitment, zkey) {
    const mimc = await buildMimcSponge()
    const rootAndPath = await calculateMerkleRootAndPath(20, commitments, commitment.commitment)
    console.log("got root and path")
    if (!rootAndPath) {
        return "commitment not found in tree"
    }
    console.log("proving...")
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        {
            nullifier: commitment.nullifier, secret: commitment.secret,
            pathElements: rootAndPath.pathElements, pathIndices: rootAndPath.pathIndices
        },
        getVerifierWASM(),
        zkey    // has to be path to zkey
    )
    const cd = convertCallData(await snarkjs.groth16.exportSolidityCallData(proof, publicSignals));
    return {
        nullifierHash: publicSignals[0],
        root: publicSignals[1],
        proof_a: cd.a,
        proof_b: cd.b,
        proof_c: cd.c
    }
}
function getVerifierWASM() {
    return loadWebAssembly().buffer
}

async function getFileNames() {
    // Lists files in the bucket
    const storage = new Storage()
    const [files] = await storage.bucket("matan-testing-bucket").getFiles();
  
    return files.map((file)=>file.name)
}

const t = async()=>{
    const SPcontractAddress = "0xa8dBc444C5e573e5cD3A3Bd004DC9B44bCf96F07"
    const AyalaAddress = "0xBaa107d8707966589254aDA3774c86a984958A3F"
    const provider = new ethers.JsonRpcProvider("https://polygon-mumbai.g.alchemy.com/v2/5hmudZ-Nalv--bEN3KMKHtxZKzklAua1")
    const ABI = [
        {
            "inputs": [
                {
                    "internalType": "uint32",
                    "name": "_levels",
                    "type": "uint32"
                },
                {
                    "internalType": "contract IHasher",
                    "name": "_hasher",
                    "type": "address"
                },
                {
                    "internalType": "contract IVerifier",
                    "name": "_verifier",
                    "type": "address"
                },
                {
                    "internalType": "contract IMetadata",
                    "name": "_metadataContract",
                    "type": "address"
                },
                {
                    "internalType": "contract IServiceProviders",
                    "name": "_spsContract",
                    "type": "address"
                },
                {
                    "internalType": "contract IPalo",
                    "name": "_fundsContract",
                    "type": "address"
                },
                {
                    "internalType": "contract IAyala",
                    "name": "_ayalaContract",
                    "type": "address"
                },
                {
                    "internalType": "string",
                    "name": "_serviceProviderENS",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "_metaData",
                    "type": "string"
                }
            ],
            "stateMutability": "payable",
            "type": "constructor"
        },
        {
            "inputs": [],
            "name": "INDEX_OF_METADATA",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "SERVICE_PROVIDER_ENS",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_productID",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_setupFee",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_monthlyFee",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "_metaData",
                    "type": "string"
                },
                {
                    "internalType": "uint256",
                    "name": "_productType",
                    "type": "uint256"
                }
            ],
            "name": "addProduct",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_commitmentDeposit",
                    "type": "uint256"
                }
            ],
            "name": "createCommitmentToRegisterENS",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_commitmentDeposit",
                    "type": "uint256"
                }
            ],
            "name": "createSubscription",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_a",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256[2][2]",
                    "name": "_proof_b",
                    "type": "uint256[2][2]"
                },
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_c",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256",
                    "name": "_nullifierHash",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_root",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_productIDHash",
                    "type": "uint256"
                }
            ],
            "name": "endSubscription",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_productID",
                    "type": "uint256"
                }
            ],
            "name": "getProductMetaData",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "ens",
                    "type": "string"
                }
            ],
            "name": "getRemainingSubscriptionUserTime",
            "outputs": [
                {
                    "internalType": "int256",
                    "name": "",
                    "type": "int256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getServiceProviderMetadata",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_a",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256[2][2]",
                    "name": "_proof_b",
                    "type": "uint256[2][2]"
                },
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_c",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256",
                    "name": "_nullifierHash",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_root",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_productIDHash",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "ens",
                    "type": "string"
                }
            ],
            "name": "startSubscription",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_a",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256[2][2]",
                    "name": "_proof_b",
                    "type": "uint256[2][2]"
                },
                {
                    "internalType": "uint256[2]",
                    "name": "_proof_c",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256",
                    "name": "_nullifierHash",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "_root",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "_userProduct",
                    "type": "string"
                }
            ],
            "name": "updateNewServiceProvider",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
        ]
    const signer = new ethers.Wallet("0x0dbc2427bcc0c03b4d7568f0ac135b543633c237d06837e8ff6dabc8ca69b3ae", provider)
    const SPcontract = new ethers.Contract(SPcontractAddress, ABI, signer)
    const abi = [
        "event Commit(bytes32 indexed commitment,uint32 leafIndex,uint256 timestamp)"
    ];
    const cmt = await generateCommitment()
    const tx = await SPcontract.createCommitmentToRegisterENS(cmt.commitment)
    console.log(cmt)
    await tx.wait()
    console.log("added commitment")
    const Ayala = new ethers.Contract(AyalaAddress, abi, provider)
    const events = await Ayala.queryFilter(Ayala.filters.Commit())
    console.log(events)
    let commitments = []
    for (let event of events) {
        commitments.push(ethers.toBigInt(event.args.commitment).toString())
    }
    console.log(commitments)
    return commitments
    // const commitments = []   0dbc2427bcc0c03b4d7568f0ac135b543633c237d06837e8ff6dabc8ca69b3ae
    // const roots = []
    // let cmt;
    // for(let i = 0;i<10;i++){
    //     const commitment = await generateCommitment()
    //     const mimc = await buildMimcSponge()
    //     console.log(commitment)
    //     commitments.push(commitment.commitment)
    //     const root = await calculateMerkleRootAndPath(20, commitments)
    //     roots.push(root)
    //     cmt = commitment
    // }

    // console.log(commitments)
    // console.log(roots)

    // const proof = await generateAndVerifyProof(commitments, cmt, "./assets/Verifier.zkey")
    // console.log(proof)
}
t()
