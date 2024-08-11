// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2;

/*
    Cryptographic Universal Blockchain Exchange (CUBE) 

    An experimental protocol in the VIDYA ecosystem that routes
    MEV volume through Uniswap V3 pools growing VIDYA through the  
    fees building up within it. 
*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface Router {
    function factory() external view returns (address);

    function positionManager() external view returns (address);

    function WETH9() external view returns (address);
}

interface Factory {
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address);
}

interface Pool {
    function initialize(uint160 _sqrtPriceX96) external;
}

interface Params {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
}

interface PositionManager is Params {
    function mint(MintParams calldata)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function collect(CollectParams calldata)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    function positions(uint256)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );
}

contract TickMath {
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = -MIN_TICK;
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO =
        1461446703485210103287273052203988822378723970342;

    function _getSqrtRatioAtTick(int24 tick)
        internal
        pure
        returns (uint160 sqrtPriceX96)
    {
        unchecked {
            uint256 absTick = tick < 0
                ? uint256(-int256(tick))
                : uint256(int256(tick));
            require(absTick <= uint256(int256(MAX_TICK)), "T");

            uint256 ratio = absTick & 0x1 != 0
                ? 0xfffcb933bd6fad37aa2d162d1a594001
                : 0x100000000000000000000000000000000;
            if (absTick & 0x2 != 0)
                ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
            if (absTick & 0x4 != 0)
                ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
            if (absTick & 0x8 != 0)
                ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
            if (absTick & 0x10 != 0)
                ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
            if (absTick & 0x20 != 0)
                ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
            if (absTick & 0x40 != 0)
                ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
            if (absTick & 0x80 != 0)
                ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
            if (absTick & 0x100 != 0)
                ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
            if (absTick & 0x200 != 0)
                ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
            if (absTick & 0x400 != 0)
                ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
            if (absTick & 0x800 != 0)
                ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
            if (absTick & 0x1000 != 0)
                ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
            if (absTick & 0x2000 != 0)
                ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
            if (absTick & 0x4000 != 0)
                ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
            if (absTick & 0x8000 != 0)
                ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
            if (absTick & 0x10000 != 0)
                ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
            if (absTick & 0x20000 != 0)
                ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
            if (absTick & 0x40000 != 0)
                ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
            if (absTick & 0x80000 != 0)
                ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

            if (tick > 0) ratio = type(uint256).max / ratio;

            sqrtPriceX96 = uint160(
                (ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1)
            );
        }
    }

    function _getTickAtSqrtRatio(uint160 sqrtPriceX96)
        internal
        pure
        returns (int24 tick)
    {
        unchecked {
            require(
                sqrtPriceX96 >= MIN_SQRT_RATIO && sqrtPriceX96 < MAX_SQRT_RATIO,
                "R"
            );
            uint256 ratio = uint256(sqrtPriceX96) << 32;

            uint256 r = ratio;
            uint256 msb = 0;

            assembly {
                let f := shl(7, gt(r, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(6, gt(r, 0xFFFFFFFFFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(5, gt(r, 0xFFFFFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(4, gt(r, 0xFFFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(3, gt(r, 0xFF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(2, gt(r, 0xF))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := shl(1, gt(r, 0x3))
                msb := or(msb, f)
                r := shr(f, r)
            }
            assembly {
                let f := gt(r, 0x1)
                msb := or(msb, f)
            }

            if (msb >= 128) r = ratio >> (msb - 127);
            else r = ratio << (127 - msb);

            int256 log_2 = (int256(msb) - 128) << 64;

            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(63, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(62, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(61, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(60, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(59, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(58, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(57, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(56, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(55, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(54, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(53, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(52, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(51, f))
                r := shr(f, r)
            }
            assembly {
                r := shr(127, mul(r, r))
                let f := shr(128, r)
                log_2 := or(log_2, shl(50, f))
            }

            int256 log_sqrt10001 = log_2 * 255738958999603826347141;

            int24 tickLow = int24(
                (log_sqrt10001 - 3402992956809132418596140100660247210) >> 128
            );
            int24 tickHi = int24(
                (log_sqrt10001 + 291339464771989622907027621153398088495) >> 128
            );

            tick = tickLow == tickHi
                ? tickLow
                : _getSqrtRatioAtTick(tickHi) <= sqrtPriceX96
                ? tickHi
                : tickLow;
        }
    }

    function _sqrt(uint256 _n) internal pure returns (uint256 result) {
        unchecked {
            uint256 _tmp = (_n + 1) / 2;
            result = _n;
            while (_tmp < result) {
                result = _tmp;
                _tmp = (_n / _tmp + _tmp) / 2;
            }
        }
    }

    function _getPriceAndTickFromValues(
        bool _weth0,
        uint256 _tokens,
        uint256 _weth
    ) internal pure returns (uint160 price, int24 tick) {
        uint160 _tmpPrice = uint160(
            _sqrt(
                (2**192 / (!_weth0 ? _tokens : _weth)) *
                    (_weth0 ? _tokens : _weth)
            )
        );
        tick = _getTickAtSqrtRatio(_tmpPrice);
        tick = tick - (tick % 200);
        price = _getSqrtRatioAtTick(tick);
    }
}

contract Cube is ERC20, Ownable, TickMath, Params {
    Router public constant ROUTER =
        Router(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45);

    uint256[] initialMCs;
    uint256[] upperMCs;
    address[] pairedTokens;
    uint256[] private liquidityPositions;
    address[] public pools;
    uint256 interval = 1 weeks;
    uint256 nextClaim;
    uint256 tokenSupply;

    mapping(address => bool) public usedTokens;
    mapping(address => mapping(uint24 => bool)) public feesUsed;

    constructor(uint256 _tokenSupply)
        ERC20("Cryptographic Universal Blockchain Exchange", "CUBE")
        Ownable(msg.sender)
    {
        tokenSupply = _tokenSupply;
        address _this = address(this);
        uint24 fee = 10000;

        // WETH
        pairedTokens.push(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        initialMCs.push(5000000000000000000); // ~$12k
        upperMCs.push(500000000000000000000000); // ~$1.29B
        (uint160 _initialSqrtPrice, ) = _getPriceAndTickFromValues(
            pairedTokens[0] < _this,
            _tokenSupply,
            initialMCs[0]
        ); // gets price

        pools.push(
            Factory(ROUTER.factory()).createPool(_this, pairedTokens[0], fee)
        ); // starts pool with 1% fee
        Pool(pools[0]).initialize(_initialSqrtPrice); // Set the pool pricing

        // DAI
        pairedTokens.push(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        initialMCs.push(12938500000000000000000); // ~$12k
        upperMCs.push(1293850000000000000000000000); // ~$1.29B
        (_initialSqrtPrice, ) = _getPriceAndTickFromValues(
            pairedTokens[1] < _this,
            _tokenSupply,
            initialMCs[1]
        );

        pools.push(
            Factory(ROUTER.factory()).createPool(_this, pairedTokens[1], fee)
        );
        Pool(pools[1]).initialize(_initialSqrtPrice);

        // TOIL
        pairedTokens.push(0x6F2495e244915B164dF57Ba135F8430fA01C4d25);
        initialMCs.push(469782000000000000000000000);
        upperMCs.push(27820000000000000000000000000);
        (_initialSqrtPrice, ) = _getPriceAndTickFromValues(
            pairedTokens[2] < _this,
            _tokenSupply,
            initialMCs[2]
        );

        pools.push(
            Factory(ROUTER.factory()).createPool(_this, pairedTokens[2], fee)
        );
        Pool(pools[2]).initialize(_initialSqrtPrice);

        nextClaim = block.timestamp + interval;
    }

    function initialize() external {
        require(totalSupply() == 0);
        _mint(address(this), tokenSupply);
        uint256 amount = tokenSupply / pairedTokens.length;
        for (uint256 i = 0; i < pairedTokens.length; i++) {
            if (totalSupply() >= amount) {
                _position(
                    initialMCs[i],
                    upperMCs[i],
                    tokenSupply / pairedTokens.length,
                    pairedTokens[i],
                    10000
                );
                feesUsed[pairedTokens[i]][10000] = true;
                usedTokens[pairedTokens[i]] = true;
            }
        }
    }

    function _position(
        uint256 lower,
        uint256 up,
        uint256 supply,
        address _token,
        uint24 fee
    ) internal {
        address _this = address(this);
        bool _token0 = _token < _this; // token0 is the lesser address()
        nextClaim = block.timestamp + interval;

        (, int24 _minTick) = _getPriceAndTickFromValues(
            _token0,
            tokenSupply,
            lower
        );
        (, int24 _maxTick) = _getPriceAndTickFromValues(
            _token0,
            tokenSupply,
            up
        );

        liquidityPositions.push(
            _createNewPosition(
                _token,
                _this,
                _token0,
                _token0 ? _maxTick : _minTick, // LowerTick
                !_token0 ? _maxTick : _minTick, // UpperTick
                supply > balanceOf(_this) ? balanceOf(_this) : supply,
                fee
            )
        );
    }

    function _createNewPosition(
        address _token,
        address _this,
        bool _token0,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 amount,
        uint24 _fee
    ) internal returns (uint256 a) {
        PositionManager _pm = PositionManager(ROUTER.positionManager());
        _approve(_this, address(_pm), amount);

        (a, , , ) = _pm.mint(
            MintParams({
                token0: _token0 ? _token : _this,
                token1: !_token0 ? _token : _this,
                fee: _fee,
                tickLower: _tickLower,
                tickUpper: _tickUpper,
                amount0Desired: _token0 ? 0 : amount,
                amount1Desired: !_token0 ? 0 : amount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: _this,
                deadline: block.timestamp
            })
        );
    }

    function createNewPosition(
        address token,
        uint256 lowerMC,
        uint256 upperMC,
        uint24 fee
    ) public onlyOwner {
        require(upperMC > lowerMC, "Fix MC");
        require(!feesUsed[token][fee], "Token Already Used");

        feesUsed[token][fee] = true;
        address _this = address(this);
        (uint160 _initialSqrtPrice, ) = _getPriceAndTickFromValues(
            token < _this,
            tokenSupply,
            lowerMC
        );
        address npool = Factory(ROUTER.factory()).createPool(
            _this,
            token,
            10000
        ); // starts pool with 1% fee
        Pool(npool).initialize(_initialSqrtPrice); // Set the pool pricing
        pools.push(npool);

        _position(lowerMC, upperMC, balanceOf(_this), token, fee);
        if (!usedTokens[token]) {
            pairedTokens.push(token);
            usedTokens[token] = true;
        }
    }

    function claimFees() public {
        require(nextClaim < block.timestamp, "Not enough time has passed");

        nextClaim = block.timestamp + interval;
        _claimFees();

        for (uint256 i = 0; i < pairedTokens.length; ) {
            IERC20 t = IERC20(pairedTokens[i]);
            uint256 _amount = t.balanceOf(address(this));
            if (_amount > 0) {
                t.transfer(msg.sender, _amount / 50);
                t.transfer(owner(), t.balanceOf(address(this)));
            }

            unchecked {
                i++;
            }
        }

        uint256 amount = address(this).balance;
        if (amount > 50) {
            address payable m = payable(msg.sender);
            bool f;
            f = m.send(amount / 50);
            address payable o = payable(owner());
            f = o.send(address(this).balance);
        }
    }

    function _claimFees() internal {
        for (uint256 i = 0; i < liquidityPositions.length; ) {
            _claim(liquidityPositions[i]);
            unchecked {
                i++;
            }
        }
    }

    function _claim(uint256 pos) internal {
        PositionManager _pm = PositionManager(ROUTER.positionManager());
        uint128 Uint128Max = type(uint128).max;
        _pm.collect(
            CollectParams({
                tokenId: pos,
                recipient: address(this),
                amount0Max: Uint128Max,
                amount1Max: Uint128Max
            })
        );
    }

    function claim() external onlyOwner {
        _claimFees();
        nextClaim = block.timestamp + interval;
        for (uint256 i = 0; i < pairedTokens.length; ) {
            IERC20 t = IERC20(pairedTokens[i]);
            if (t.balanceOf(address(this)) > 0) {
                t.transfer(msg.sender, t.balanceOf(address(this)));
            }

            unchecked {
                i++;
            }
        }

        uint256 amount = address(this).balance;
        if (amount > 0) {
            address payable o = payable(owner());
            bool f;
            f = o.send(amount);
        }
    }

    receive() external payable {}

    function liquidityPositons() external view returns (uint256[] memory) {
        return liquidityPositions;
    }

    function claimSpecficPositions(uint256[] memory positions) external {
        for (uint256 i = 0; i < positions.length; ) {
            _claim(positions[i]);
            unchecked {
                i++;
            }
        }
    }

    function erc20Withdrawal(address[] memory tokens) external onlyOwner {
        address _this = address(this);
        for (uint256 i = 0; i < tokens.length; ) {
            require(tokens[i] != _this, "Cannot withdraw contract token");
            IERC20 t = IERC20(tokens[i]);
            t.transfer(msg.sender, t.balanceOf(_this));
            unchecked {
                i++;
            }
        }

        uint256 amount = address(this).balance;
        if (amount > 0) {
            address payable o = payable(owner());
            bool f;
            f = o.send(amount);
        }
    }

    function pairedTokensView() public view returns (address[] memory) {
        return pairedTokens;
    }
}
