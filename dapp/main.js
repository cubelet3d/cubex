function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

window.onload = function() {
    if (localStorage.getItem("username")) {
        if (window.ethereum) {
            connectWeb3();
        }
    }

    const tokenAddress = getQueryParam('token');
    showTokenDetails = !!tokenAddress; // Ensure boolean representation

    if (tokenAddress) {
        console.log('Token management mode activated for:', tokenAddress);
        loadTokenData(tokenAddress);
        toggleWeb3Elements();
    }
	
	volumeTokenInput.textContent = wethAddress; 
};




// Variables 
let showTokenDetails = false; 
let user; 
let web3; 
let contract; 
let currentNetworkId; 

// Addresses 
let wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // set to mainnet for prettier UI upon first load 
let uniswapFactory;
let wethDaiPool;

// Network specifics 
const networkData = {
	"1": {
		name: "Ethereum Mainnet",
		explorerUrl: "https://etherscan.io/",
		wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
		uniswapFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
		wethDaiPool: "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11"
	},
	"42161": {
		name: "Arbitrum One",
		explorerUrl: "https://arbiscan.io/",
		wethAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
		uniswapFactory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
		wethDaiPool: "0x8dca5a5DBA32cA529594d43F86ED4210EaD2Ed83"
	},
	"8453": {
		name: "Base Mainnet",
		explorerUrl: "https://basescan.org/",
		wethAddress: "0x4200000000000000000000000000000000000006",
		uniswapFactory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
		wethDaiPool: "0xb2839134B8151964f19f6f3c7D59C70ae52852F5"
	}
}

let uniswapFactoryABI = [{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"getPair","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"}];

let genericABI = [{"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}];




// Elements
const btn_web3Connect = document.getElementById("web3Connect");
const btn_web3Deploy = document.getElementById("web3Deploy"); 
const btn_web3Reset = document.getElementById("web3Reset"); 
const topUserBar = document.getElementById("topUserBar");
const usernameSpan = topUserBar.querySelector(".username");
const blockieSpan = topUserBar.querySelector(".blockie");
const nameInput = document.getElementById("nameInput");
const symbolInput = document.getElementById("symbolInput");
const totalSupplyInput = document.getElementById("totalSupplyInput"); 
const volumeTokenInput = document.getElementById("volumeTokenInput");
const welcomeScreen = document.getElementById("welcomeScreen"); 
const btn_web3Initialize = document.getElementById("web3Initialize"); 
const btn_web3Claim = document.getElementById("web3Claim"); 
const btn_docuButton = document.getElementById("docuButton");
const docContainer = document.getElementById("documentationContainer");
const btn_closeDocs = document.getElementById("closeDocs");




btn_web3Connect.addEventListener("click", async function(event) {
    event.preventDefault();

    // Check if the button is in 'Connect' or 'Disconnect' state
    if (btn_web3Connect.textContent.includes("Connect")) {
		connectWeb3(); 
    } else {
		blockieSpan.style.backgroundImage = "none"; 
		usernameSpan.textContent = "Unknown user"; 
        btn_web3Connect.textContent = " Connect ";

		document.querySelectorAll('.web3Element').forEach(el => el.classList.add('hidden'));
		welcomeScreen.classList.remove("hidden"); 
		
		user = null; 
		
        console.log('Disconnected');
    }
});

btn_web3Deploy.addEventListener("click", async function(event) {
    event.preventDefault();

    const name = document.getElementById('nameInput').textContent;
    const symbol = document.getElementById('symbolInput').textContent;
    const supplyText = document.getElementById('totalSupplyInput').textContent;
    const volumeToken = document.getElementById('volumeTokenInput').textContent;

    // Validation Flags
    let isValid = true;
    let errors = [];

    // Check for empty fields
    if (!name || !symbol || !supplyText || !volumeToken) {
        isValid = false;
        errors.push('All fields must be filled out.');
    }

    // Validate Name and Symbol
    if (name.length > 100 || symbol.length > 10) { // max 100 chars for name, 10 for symbol
        isValid = false;
        errors.push('Token name or symbol is too long.');
    }

    // Validate Supply is a number and not less than zero
    const supply = web3.utils.toWei(supplyText);
    if (isNaN(supply) || supply <= 0) {
        isValid = false;
        errors.push('Supply must be a positive number.');
    }

    // Validate Ethereum Address (Volume Token)
    if (!web3.utils.isAddress(volumeToken)) {
        isValid = false;
        errors.push('Volume Token must be a valid Ethereum address.');
    }
	
	// Validate volumeToken for 18 decimals 
	// Note: this probably isn't an issue any more as lowHigh is calculated taking decimals into account 
	let token = new web3.eth.Contract(cubeABI, volumeToken);
	let decimals = await token.methods.decimals().call();
	if(decimals !== '18') {
		isValid = false;
		errors.push('Volume token must have 18 decimal places.');
	}

    // If validation fails, display errors and exit function
    if (!isValid) {
        const validatorNotification = createNotification("Validation error");
        appendToNotificationBody(validatorNotification, errors.join('<br>'));
        return;
    }

    // Proceed with deployment if valid
    await deployToken(name, symbol, supply, volumeToken);
});

btn_web3Reset.addEventListener("click", function() {
	// Default values 
	nameInput.textContent = "myToken";
	symbolInput.textContent = "TKN";
	totalSupplyInput.textContent = "1000000000";
	volumeTokenInput.textContent = wethAddress;
}); 

btn_web3Initialize.addEventListener("click", async function() {
    if (contract) {
        const initializeNotification = createNotification("Initialization");
        appendToNotificationBody(initializeNotification, `Please confirm the transaction in your wallet`);

        await contract.methods.initialize().send({
                from: user
            })
            .on('transactionHash', function(hash) {
                appendToNotificationBody(initializeNotification, `Initialization pending...`);
            })
            .on('receipt', function(receipt) {
                appendToNotificationBody(initializeNotification, `Contract initialized!`);
                appendToNotificationBody(initializeNotification, `Reloading the page in 5 seconds...`);
                setTimeout(function() {
                    location.reload();
                }, 5000);
            })
    } else {
        const errorNotification = createNotification("Error");
        appendToNotificationBody(errorNotification, `Contract instance could not be loaded. Try reloading the page.`);
    }
});

btn_web3Claim.addEventListener("click", async function() {
    if (contract) {
        const claimNotification = createNotification("Claim fees");
        appendToNotificationBody(claimNotification, `Please confirm the transaction in your wallet`);

        await contract.methods.claimFees().send({
                from: user
            })
            .on('transactionHash', function(hash) {
                appendToNotificationBody(claimNotification, `Claiming fees...`);
            })
            .on('receipt', function(receipt) {
                appendToNotificationBody(claimNotification, `Fees claimed! ;)`);
            })
    } else {
        const errorNotification = createNotification("Error");
        appendToNotificationBody(errorNotification, `Contract instance could not be loaded. Try reloading the page.`);
    }
});

btn_docuButton.addEventListener("click", function() {
    docContainer.classList.remove('hidden');
	adjustBodyHeight();
});

btn_closeDocs.addEventListener("click", function() {
    docContainer.classList.add('hidden');
});



// Load token data
async function loadTokenData(tokenAddress) {
    if (typeof web3 !== 'undefined') {
        web3 = new Web3(web3.currentProvider);
    } else {
        const metamaskNotification = createNotification("Web3 not found");
        appendToNotificationBody(metamaskNotification, `You need to install MetaMask or other web3 provider for this feature to work.`);		
        return;
    }

    // Create contract instance
    contract = new web3.eth.Contract(cubeABI, tokenAddress);
	
	try {
		// Call functions to get details
		const name = await contract.methods.name().call();
		const symbol = await contract.methods.symbol().call();
		const totalSupply = await contract.methods.totalSupply().call();
		
		// Fill the UI fields 
		document.querySelectorAll(".tokenSymbol").forEach(element => { element.textContent = symbol; });

		document.querySelectorAll(".tokenName").forEach(element => { element.textContent = name; });

		document.querySelectorAll(".totalSupply").forEach(element => { element.textContent = web3.utils.fromWei(totalSupply); });
		
		if (totalSupply == 0) {
			// total supply is 0 meaning token is not initialized 
			document.getElementById("initializeContainer").classList.remove("hidden");
		} else {
			// show dexscreener for live tokens 
			updateEmbedTokenAddress(tokenAddress);
		}
	} catch(e) {
        const invalidTokenNotification = createNotification("Invalid token");
        appendToNotificationBody(invalidTokenNotification, `Cannot fetch token information. Make sure you are connected to the right network.`);	
		return; 
	}

	// Look for liquidity positions 
    try {
        const liquidityPositons = await contract.methods.liquidityPositons().call();
        loadLiquidityPositions(liquidityPositons);

        // Show claim container 
        document.getElementById("claimContainer").classList.remove("hidden");
    } catch (e) {
        console.error(e);
        const liquidityNotification = createNotification("Invalid token");
        appendToNotificationBody(liquidityNotification, `This token is not a native CubeX or it hasn't been initialized yet.`);
        return;
    }

    // Claim button enable / disable 
    let nextClaim = await contract.methods.nextClaim().call();
    let currentTime = Math.floor(Date.now() / 1000);
    if (nextClaim < currentTime) {
        document.getElementById("web3Claim").classList.remove("disabled");
    } else {
        document.getElementById("web3Claim").classList.add("disabled");
    }
}

function toggleWeb3Elements() {
    const tokenDetailsElements = document.querySelectorAll('.tokenDetails');
    const deployElements = document.querySelectorAll('.deploy');

    if (showTokenDetails) {
        // Show token details and hide deploy elements
        tokenDetailsElements.forEach(el => el.classList.remove('hidden'));
        deployElements.forEach(el => el.classList.add('hidden'));
		welcomeScreen.classList.add("hidden");
    } else {
        // Show deploy elements and hide token details
        tokenDetailsElements.forEach(el => el.classList.add('hidden'));
        deployElements.forEach(el => el.classList.remove('hidden'));
    }
}

async function loadLiquidityPositions(positions) {
    const container = document.getElementById('liquidityPositionsContainer');
    container.innerHTML = '<span class="comment">// Liquidity positions</span>\n<span class="function">liquidityPositions</span> [\n'; // Start the content

    try {
        positions.forEach((positionId, index) => {
            const entry = `   <span class="property">${index}</span>: <a href="https://app.uniswap.org/pools/${positionId}" target="_blank"><span class="string" style="cursor: pointer;">"${positionId}"</span></a>${index < positions.length - 1 ? ',' : ''}\n`;
            container.innerHTML += entry;
        });

        container.innerHTML += ']'; // Close the bracket
    } catch (error) {
        console.error('Failed to load liquidity positions:', error);
        container.textContent = 'Failed to load liquidity positions.';
    }
}

function updateEmbedTokenAddress(tokenAddress) {
    const embedContainer = document.getElementById('embedContainer');

    // Determine the correct network subdirectory based on currentNetworkId
    let networkSubdir;
    if (currentNetworkId === 1) {
        networkSubdir = "ethereum";
    } else if (currentNetworkId === 42161) {
        networkSubdir = "arbitrum";
    } else if (currentNetworkId === 8453) {
        networkSubdir = "base";
    } else {
        console.error("Unsupported network for embedding.");
        return;
    }

    // Construct the full URL with the correct network subdirectory and token address
    const baseURL = `https://dexscreener.com/${networkSubdir}/`;
    const fullURL = `${baseURL}${tokenAddress}?embed=1&theme=dark&trades=0&info=0`;

    // HTML structure for the embed code with the updated token address
    const embedHTML = `<style>#dexscreener-embed{position:relative;width:100%;height:0;padding-bottom:50%;}@media(min-width:1400px){#dexscreener-embed{padding-bottom:65%;}}#dexscreener-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}</style><div id="dexscreener-embed"><iframe src="${fullURL}" frameborder="0"></iframe></div>`;

    // Set the innerHTML of the container to the new embed code
    embedContainer.innerHTML = embedHTML;
}

async function deployToken(name, symbol, supply, volumeToken) {
	try {
		const deployNotification = createNotification("Contract deployment");
		appendToNotificationBody(deployNotification, `Creating ${name}...`); 
		
		let lowHigh = await calculateLowHighMcaps(volumeToken, deployNotification);
		if (!lowHigh) { // Check if lowHigh is null which means an error occurred
			appendToNotificationBody(deployNotification, `Deployment stopped due to an error.`);
			return;
		}

		// Fetch current gas price from the network
		const currentGasPrice = await web3.eth.getGasPrice();
		
		console.log({name, symbol, supply, volumeToken, lowHigh});
		
		let bytecode;

		if (currentNetworkId === 1) {
			bytecode = mainnet_bytecode; // Ethereum Mainnet bytecode
		} else if (currentNetworkId === 42161) {
			bytecode = arbitrum_bytecode; // Arbitrum bytecode
		} else if (currentNetworkId === 8453) {
			bytecode = base_bytecode; // Base bytecode
		} else {
			appendToNotificationBody(deployNotification, `Unsupported network for deployment.`);
			let supportedNetworks = Object.values(networkData).map(network => network.name);
			appendToNotificationBody(deployNotification, `Currently supported networks: ${supportedNetworks.join(', ')}`);
			return;
		}	
		
		// Setup the transaction 
		const deployTransaction = new web3.eth.Contract(cubeABI).deploy({
			data: bytecode,
			arguments: [name, symbol, supply, volumeToken, lowHigh]
		});
		
		// Estimate gas & simulate deployment 
		const estimatedGas = await deployTransaction.estimateGas({
			from: user
		});
		
		// Send the transaction
		const transactionHandle = deployTransaction.send({
			from: user,
			gas: estimatedGas,
			gasPrice: currentGasPrice
		});
		
		appendToNotificationBody(deployNotification, `Waiting for user to confirm in wallet...`); 
		
		transactionHandle.on('transactionHash', (hash) => {
			console.log('Transaction Hash:', hash);
			appendToNotificationBody(deployNotification, `Sending the transaction...`);
		});	
		
		// Listen for confirmations 
		transactionHandle.on('confirmation', (confirmationNumber, receipt) => {
			console.log(`Transaction confirmed ${confirmationNumber} times.`);
			appendToNotificationBody(deployNotification, `Transaction confirmation ${confirmationNumber} / 2...`); 
			if (confirmationNumber === 2) {
				const contractAddress = receipt.contractAddress;
				console.log('Contract deployed at:', contractAddress);

				// Verify contract after 2 confirmations
				console.log(`Verifying contract...`);
				appendToNotificationBody(deployNotification, `Verifying contract...`); 
				
				let encodedArguments = web3.eth.abi.encodeParameters(['string', 'string', 'uint256', 'address', 'uint256[]'], [name, symbol, supply, volumeToken, lowHigh]).substr(2);
				
				let contractData = {
					contractAddress: contractAddress,
					constructorArguments: encodedArguments,
					chainId: currentNetworkId
				};
				
				verifyContract(contractData);
				
				transactionHandle.off('confirmation'); // stop listening 
				appendToNotificationBody(deployNotification, `Finished!`); 
				appendToNotificationBody(deployNotification, `You can access your cubex here: <a class="string" href="?token=${contractAddress}" target="_blank">${contractAddress}</a>`); 
			}
		})
		.on('error', console.error);
	}
	catch(e) {
		console.error(e);
	}
}

async function verifyContract(data) {
    try {
        const response = await fetch('https://dapp.cubex.one/verifyContract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
			mode: 'cors'
        });
        const result = await response.json();
        console.log('Verification result:', result);
        return result;
    } catch (error) {
        console.error('Failed to verify contract:', error);
    }
}

function encodeConstructorArguments(web3, types, args) {
    return web3.eth.abi.encodeParameters(types, args);
}

let notificationIdCounter = 0;

function createNotification(title, body) {
    const notifId = `notification-${notificationIdCounter++}`;
    const notifWrapper = document.createElement('div');
    notifWrapper.className = 'notificationWrapper';
    notifWrapper.id = notifId;

    const header = document.createElement('div');
    header.className = 'header flex-box space-between';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title string';
    titleSpan.textContent = title;

    const closeButton = document.createElement('span');
    closeButton.className = 'button';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => notifWrapper.remove();

    header.appendChild(titleSpan);
    header.appendChild(closeButton);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'body string';
    bodyDiv.textContent = body;

    notifWrapper.appendChild(header);
    notifWrapper.appendChild(bodyDiv);
    document.body.appendChild(notifWrapper);

    return notifWrapper; 
}

function appendToNotificationBody(notificationElement, content) {
	adjustNotificationContainer();
	
    if (notificationElement && notificationElement.getElementsByClassName) {
        const bodyDiv = notificationElement.getElementsByClassName('body')[0];
        if (bodyDiv) {
            // Create a new span element to hold the new content
            const contentSpan = document.createElement('div');
			contentSpan.className = 'content'; 
            contentSpan.innerHTML = `${content}<br><br>`;
            bodyDiv.appendChild(contentSpan); // Append the new content span to the body
        }
    }
}

async function connectWeb3() {
    if (window.ethereum) {
        try {
            web3 = new Web3(window.ethereum);
			
			let chainId = await web3.eth.getChainId();
			currentNetworkId = chainId; 

			// Subscribe to network change 
			window.ethereum.on('chainChanged', function(chainId) {
				connectWeb3();
			});			

			if(!networkData.hasOwnProperty(chainId.toString())) {
				const networkNotification = createNotification("Wrong network");
				let supportedNetworks = Object.values(networkData).map(network => network.name);
				appendToNotificationBody(networkNotification, `Currently supported networks: ${supportedNetworks.join(', ')}`);
			}
			
			// Update network name & id on UI 
			document.querySelectorAll('.networkDetails').forEach(el => {
				el.textContent = `${networkData[chainId.toString()].name} #${chainId}`;
			});	

			// Update global variables based on networkId 
			wethAddress = networkData[chainId.toString()].wethAddress;
			volumeTokenInput.textContent = wethAddress; // Update UI input element 
			uniswapFactory = networkData[chainId.toString()].uniswapFactory;
			wethDaiPool = networkData[chainId.toString()].wethDaiPool;

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
			
            const account = accounts[0];
            user = accounts[0];
            localStorage.setItem("username", user);

            if (account) {
                // Generate blockie and set as background image
                const blockieImage = blockies.create({
                    seed: account.toLowerCase()
                }).toDataURL();
                blockieSpan.style.backgroundImage = `url(${blockieImage})`;

                // Set the account address as username
                usernameSpan.textContent = formatAddress(account); 

                // Change button text to 'Disconnect'
                btn_web3Connect.textContent = "Disconnect";

                // Hide welcome screen 
                welcomeScreen.classList.add("hidden");

                // Show all web3 items 
                document.querySelectorAll('.web3Element').forEach(el => el.classList.remove('hidden'));

                toggleWeb3Elements(); // container specific 

                console.log('Connected', account);

                getGasPrice(); // Start getting gas price 
            }
        } catch (error) {
            console.error("Could not connect to MetaMask", error);
        }
    } else {
        console.log('MetaMask is not available!');
    }
}

async function getGasPrice() {
    try {
        const gasPriceWei = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPriceWei, "gwei");

        document.querySelectorAll('.currentGasPrice').forEach(el => {
            el.textContent = `${gasPriceGwei} gwei`;
        });

        setTimeout(getGasPrice, 1000);
    } catch (error) {
        console.error("Failed to fetch gas price:", error);
        setTimeout(getGasPrice, 1000);
    }
}

// Return the low and high mcap range for given token 
async function calculateLowHighMcaps(token, deployNotification) {
    try { 
		appendToNotificationBody(deployNotification, `Calculating optimal low & high position range...`);
	
        // Handle WETH directly
        if (token.toLowerCase() === wethAddress.toLowerCase()) {
            const ethPriceInDai = await ethPrice(); // Fetch the current ETH price in USD

            if (!ethPriceInDai) {
                appendToNotificationBody(deployNotification, `Could not fetch ETH price.`);
                throw new Error("Could not fetch ETH price.");
            }

            // Calculate low and high market caps for WETH/ETH in token units
            const lowMCap = 12000 / ethPriceInDai;  // $12K market cap in ETH
            const highMCap = 1290000000 / ethPriceInDai; // $1.29B market cap in ETH

            const lowMCapWei = BigInt(Math.floor(lowMCap * Math.pow(10, 18))).toString();  // Convert to smallest unit (wei)
            const highMCapWei = BigInt(Math.floor(highMCap * Math.pow(10, 18))).toString(); // Convert to smallest unit (wei)

            return [lowMCapWei, highMCapWei]; // Return low and high caps in wei for WETH
        }

        // Otherwise, handle non-WETH tokens with existing logic	
		const pool = await pairFor(token); 
		if (!pool || pool === '0x0000000000000000000000000000000000000000') {
			appendToNotificationBody(deployNotification, `Sorry, cannot figure out token price from V2 pools.`); 
            throw new Error("No liquidity pool found for this token.");
        }
		
		// appendToNotificationBody(deployNotification, `Calculating optimal low & high position range...`);
        const lowMCap = await calculateTokenQuantityForMarketCap(token, pool, 12000); // $12K in token units
        const highMCap = await calculateTokenQuantityForMarketCap(token, pool, 1290000000); // $1.29B in token units 
		
        const lowMCapWei = BigInt(Math.floor(lowMCap)).toString();
        const highMCapWei = BigInt(Math.floor(highMCap)).toString();

        return [lowMCapWei, highMCapWei]; // Return low and high market caps in token smallest units
    } catch (e) {
        console.error("Error processing market caps:", e);
        return null;
    }
}

async function calculateTokenQuantityForMarketCap(token, pool, usdAmount) {
    const tokenContract = new web3.eth.Contract(genericABI, token);
    try {
        const priceInDai = await volumeTokenPrice(token, pool); // Get price of token in USD
        const tokenDecimals = await getTokenDecimals(tokenContract);
        const totalSupply = await tokenContract.methods.totalSupply().call();
        const totalSupplyInTokens = await convertToDecimalUnits(totalSupply, tokenDecimals);

        // Calculate the number of tokens corresponding to the given USD market cap
        const numberOfTokens = usdAmount / priceInDai; // This gives you the number of tokens in regular units
        const tokenQuantityInSmallestUnits = numberOfTokens * Math.pow(10, tokenDecimals); // Convert to smallest unit

        return tokenQuantityInSmallestUnits;
    } catch (e) {
        console.error(`Failed to calculate token quantity for market cap ${usdAmount} for ${token}:`, e);
        return null;
    }
}

async function ethPrice() {
    const contract = new web3.eth.Contract(genericABI, wethDaiPool);
    try {
        const reserves = await contract.methods.getReserves().call();
        const reserve0 = web3.utils.fromWei(reserves._reserve0);
        const reserve1 = web3.utils.fromWei(reserves._reserve1);
        if (reserve1 !== '0') {
            return parseFloat(reserve0) / parseFloat(reserve1);
        } else {
            throw new Error('Reserve1 is zero, cannot calculate price.');
        }
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function volumeTokenPrice(token, pool) {
    const contract = new web3.eth.Contract(genericABI, pool);
	const contract2 = new web3.eth.Contract(genericABI, token);

    try {
        const reserves = await contract.methods.getReserves().call();
        const tokenDecimals = await getTokenDecimals(contract2);

        const reserve0 = await convertToDecimalUnits(reserves._reserve0, tokenDecimals);
        const reserve1 = await convertToDecimalUnits(reserves._reserve1, tokenDecimals);

        if (reserve1 === 0) {
            throw new Error('Reserve1 is zero, cannot calculate price.');
        }

        const ethPriceInTokens = reserve0 / reserve1;
        const ethPriceInDai = await ethPrice(wethDaiPool); // Ensure wethDaiPool is defined and passed correctly

        return ethPriceInDai / ethPriceInTokens; // Token price in $DAI
    } catch (e) {
        console.error(e);
        return null; // Explicitly return null if there's an error
    }
}

async function pairFor(volumeToken) {
	try {
		const contract = new web3.eth.Contract(uniswapFactoryABI, uniswapFactory);
		const pair = await contract.methods.getPair(volumeToken, wethAddress).call();
		return pair; 
	}
	catch(e) {
		console.error(e); 
	}
}

async function getTokenDecimals(contract) {
    try {
        return await contract.methods.decimals().call();
    } catch (e) {
        console.error('Failed to fetch token decimals:', e);
        return 18; // Assuming default as 18 if unable to fetch
    }
}

async function convertToDecimalUnits(value, decimals) {
    return value / Math.pow(10, decimals);
}

function formatAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}




let cube = document.getElementById('cube');

cube.classList.add('rotating');

document.addEventListener('mousemove', function(e) {
    cube.classList.remove('rotating');

    let xPercent = (e.clientX / window.innerWidth) * 2 - 1;
    let yPercent = (e.clientY / window.innerHeight) * 2 - 1;

    let xRotation = yPercent * -20;
    let yRotation = xPercent * 20;

    cube.style.transform = `rotateX(${xRotation}deg) rotateY(${yRotation}deg)`;
});

document.addEventListener('mouseleave', function() {
    cube.classList.add('rotating');
});

document.querySelectorAll('.code-editor span[contenteditable="true"]').forEach(element => {
    element.addEventListener('paste', function(e) {
        e.preventDefault(); // Prevent the default paste behavior
        const text = e.clipboardData.getData('text/plain').replace(/\n/g, ''); // Get clipboard data and remove newlines
        document.execCommand('insertText', false, text); // Insert text cleanly
    });

    element.addEventListener('keydown', function(e) {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent new lines on Enter key to keep UI tidy
        }
    });
});

function adjustBodyHeight() {
    const header = document.querySelector('.documentationContainer .header');
    const body = document.querySelector('.documentationContainer .body');

    if (header && body) {
        const headerHeight = header.offsetHeight;
        body.style.height = `calc(100% - ${headerHeight}px)`;
    }
}

function adjustNotificationContainer() {
    const notificationHeader = document.querySelector('.notificationWrapper .header');
    const notificationBody = document.querySelector('.notificationWrapper .body');

    if (notificationHeader && notificationBody) {
        const notificationHeaderHeight = notificationHeader.offsetHeight;
        notificationBody.style.height = `calc(100% - ${notificationHeaderHeight}px)`;
    }	
}

async function cubePrice() {
	const abi = [{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"}]; 
	const address = "0x1b59e5e90b1d1d97b82e712D9FdC84ED69c83Ae7";
	const contract = new web3.eth.Contract(abi, address); 
	
	try {
        const { sqrtPriceX96 } = await contract.methods.slot0().call();
        const n = (sqrtPriceX96 / 2**96) ** 2;
        const price = 1 / n;
        
		return price; 
	}
	
	catch(e) {
		console.error(e); 
	}
}