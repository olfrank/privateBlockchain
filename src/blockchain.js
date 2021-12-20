/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const hex2ascii = require('hex2ascii');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {

            try{
                block.height = await self.getChainHeight();

                block.time = paresInt(new Date().getTime().toString().slice(0,-3));
                console.log(block.time + " block time");

                if(block.height > -1 ){
                    block.previousBlockHash = self.chain[self.chain.length-1].hash;
                }else{
                    block.previousBlockHash = null;
                }

                block.hash = SHA256(JSON.stringify(block)).toString();
                //console.log(block.hash + " block hash");
                self.chain.push(block);
                self.height ++;
                
                console.log(block);

                self.validateChain().then((errorLog) => {
                    if(errorLog.length > 0){ // *** If the array has items or an error is thrown...
                        self.chain.pop();// *** ...the block creation process must be aborted.
                        reject(errorLog);
                    }else{
                        resolve(block);
                    }
                })

            }catch{
                reject(Error("Failed to add new block"))
            }

        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            let time  = paresInt(new Date().getTime().toString().slice(0,-3));

            resolve(`${address}:${time}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
        
        try{
            let messageTime = parseInt(message.split(':')[1])
            let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            if(currentTime - messageTime <= 300 ){
                if(!bitcoinMessage.verify(message, address, signature)){
                    return reject(Error("Bitcoin verfiication failed"))
                }
                let data = { 
                    owner: address, 
                    message: message,
                    signature: signature, 
                    star: star
                }
                let newBlock = new BlockClass.Block(data); //assigning new block data to variable
                await self._addBlock(newBlock); //adding block to chain 
                resolve(newBlock);
            }
            
        }catch (error){
            console.log(error);
            reject(Error("Could not submit star"));
        }
            
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter((block)=>{
                return block.hash === hash;
            })

            if(!block){
                reject(Error("Could not find block"));
            }else{
                resolve(block);
            }

        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.find(p => p.height === height);
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            try{
                self.chain.forEach(async(block)=>{
                    let decoded_data = await block.getBData();
                    if(decoded_data.owner === address){
                            stars.push(decoded_data);
                    }
                })
                resolve(stars);

            }catch (error){
                console.log(error)
                reject(Error("could not obtain stars for wallet address given"))
            }
            
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validate()`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise( (resolve, reject) => {
            try{
                self.chain.forEach(async(block)=>{
                    let isBlockValid = await block.validate();
                    let previousBHash = self.chain[self.chain.length-1].hash;

                    if(!isBlockValid){
                        errorLog.push({error: 'Block validation failed'})
                    }
                    if(block.height < 1 ){
                        errorLog.push({error: 'Genesis block does not need verifying'})
                    }
                    if(block.previousBlockHash !== previousBHash){
                        errorLog.push({error: 'hash of previous block does not match'})
                    }
                })
                resolve(errorLog);

            }catch{
                reject(Error("Could not validate chain"));

            }
            
        });
    }

}

module.exports.Blockchain = Blockchain;   