// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EventContract
 * @dev Base blockchain'de event oluşturma ve yönetimi için contract
 */
contract EventContract {
    struct Event {
        uint256 id;
        string title;
        string description;
        uint256 date;
        string placeId;
        address creator;
        uint256 createdAt;
        bool exists;
    }

    // Event ID'den Event'e mapping
    mapping(uint256 => Event) public events;
    
    // Creator address'ten event ID listesine mapping
    mapping(address => uint256[]) public userEvents;
    
    // Event counter
    uint256 private eventCounter;

    // Events
    event EventCreated(
        uint256 indexed eventId,
        address indexed creator,
        string title,
        uint256 date
    );

    /**
     * @dev Yeni bir event oluştur
     * @param title Event başlığı
     * @param description Event açıklaması
     * @param date Event tarihi (Unix timestamp)
     * @param placeId Place ID (Google Places)
     * @return eventId Oluşturulan event'in ID'si
     */
    function createEvent(
        string memory title,
        string memory description,
        uint256 date,
        string memory placeId
    ) public returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(date > block.timestamp, "Date must be in the future");

        eventCounter++;
        uint256 newEventId = eventCounter;

        events[newEventId] = Event({
            id: newEventId,
            title: title,
            description: description,
            date: date,
            placeId: placeId,
            creator: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });

        userEvents[msg.sender].push(newEventId);

        emit EventCreated(newEventId, msg.sender, title, date);

        return newEventId;
    }

    /**
     * @dev Event bilgilerini getir
     * @param eventId Event ID
     * @return Event struct
     */
    function getEvent(uint256 eventId) public view returns (Event memory) {
        require(events[eventId].exists, "Event does not exist");
        return events[eventId];
    }

    /**
     * @dev Kullanıcının event'lerini getir
     * @param user Kullanıcı address'i
     * @return Event ID listesi
     */
    function getUserEvents(address user) public view returns (uint256[] memory) {
        return userEvents[user];
    }

    /**
     * @dev Toplam event sayısını getir
     * @return Event counter
     */
    function getEventCount() public view returns (uint256) {
        return eventCounter;
    }
}

