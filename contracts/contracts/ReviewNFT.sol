// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReviewNFT
 * @dev Place yorumlarını NFT olarak mint eden contract
 */
contract ReviewNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    struct Review {
        uint256 tokenId;
        string placeId;
        uint8 rating;
        string comment;
        string[] photos;
        address reviewer;
        uint256 createdAt;
    }

    // Token ID'den Review'e mapping
    mapping(uint256 => Review) public reviews;
    
    // Place ID'den token ID listesine mapping
    mapping(string => uint256[]) public placeReviews;

    // Events
    event ReviewMinted(
        uint256 indexed tokenId,
        address indexed reviewer,
        string placeId,
        uint8 rating
    );

    constructor() ERC721("PlaceReview", "PREV") Ownable(msg.sender) {}

    /**
     * @dev Yeni bir review NFT mint et
     * @param placeId Place ID (Google Places)
     * @param rating Rating (1-5)
     * @param comment Yorum metni
     * @param photos Photo URL'leri
     * @return tokenId Mint edilen NFT'nin token ID'si
     */
    function mintReview(
        string memory placeId,
        uint8 rating,
        string memory comment,
        string[] memory photos
    ) public returns (uint256) {
        require(bytes(placeId).length > 0, "Place ID cannot be empty");
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5");
        require(bytes(comment).length > 0, "Comment cannot be empty");

        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        _safeMint(msg.sender, newTokenId);

        reviews[newTokenId] = Review({
            tokenId: newTokenId,
            placeId: placeId,
            rating: rating,
            comment: comment,
            photos: photos,
            reviewer: msg.sender,
            createdAt: block.timestamp
        });

        placeReviews[placeId].push(newTokenId);

        // Token URI oluştur (metadata için)
        string memory tokenURI = _createTokenURI(newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        emit ReviewMinted(newTokenId, msg.sender, placeId, rating);

        return newTokenId;
    }

    /**
     * @dev Review bilgilerini getir
     * @param tokenId Token ID
     * @return Review struct
     */
    function getReview(uint256 tokenId) public view returns (Review memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return reviews[tokenId];
    }

    /**
     * @dev Place'in review'lerini getir
     * @param placeId Place ID
     * @return Token ID listesi
     */
    function getPlaceReviews(string memory placeId) public view returns (uint256[] memory) {
        return placeReviews[placeId];
    }

    /**
     * @dev Token URI oluştur (metadata için)
     */
    function _createTokenURI(uint256 tokenId) private view returns (string memory) {
        Review memory review = reviews[tokenId];
        // Basit JSON metadata (gerçek uygulamada IPFS kullanılabilir)
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(bytes(string(abi.encodePacked(
                '{"name":"Review #',
                _toString(tokenId),
                '","description":"',
                review.comment,
                '","image":"',
                review.photos.length > 0 ? review.photos[0] : "",
                '","attributes":[{"trait_type":"Rating","value":',
                _toString(review.rating),
                '},{"trait_type":"Place ID","value":"',
                review.placeId,
                '"}]}'
            ))))
        ));
    }

    // Helper functions
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _base64Encode(bytes memory data) private pure returns (string memory) {
        // Basit base64 encoding (production'da library kullanın)
        // Bu örnek için basit bir placeholder
        return "eyJuYW1lIjoiUmV2aWV3In0=";
    }

    // Override functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

