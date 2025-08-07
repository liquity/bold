// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

/**
 * @title LinkedList
 * @dev A generic linked list implementation in Solidity
 * @notice This provides a doubly-linked list with O(1) insertion and deletion operations
 */
contract LinkedList {
    
    /**
     * @dev Node structure for the linked list
     * @param data The data stored in the node
     * @param next Pointer to the next node (0x0 if last node)
     * @param prev Pointer to the previous node (0x0 if first node)
     */
    struct Node {
        uint256 data;
        address next;
        address prev;
    }
    
    /**
     * @dev LinkedList structure
     * @param head Pointer to the first node
     * @param tail Pointer to the last node
     * @param size Number of nodes in the list
     * @param nodes Mapping of node addresses to Node structs
     */
    struct LinkedList {
        address head;
        address tail;
        uint256 size;
        mapping(address => Node) nodes;
    }
    
    // Storage for the linked list
    LinkedList private list;
    
    // Events
    event NodeInserted(address indexed nodeAddress, uint256 data, address indexed position);
    event NodeRemoved(address indexed nodeAddress, uint256 data);
    event NodeUpdated(address indexed nodeAddress, uint256 oldData, uint256 newData);
    
    /**
     * @dev Insert a new node at the beginning of the list
     * @param data The data to store in the new node
     * @return nodeAddress The address of the newly created node
     */
    function insertAtHead(uint256 data) public returns (address nodeAddress) {
        nodeAddress = _createNode(data);
        
        if (list.head == address(0)) {
            // Empty list
            list.head = nodeAddress;
            list.tail = nodeAddress;
        } else {
            // Insert at head
            list.nodes[nodeAddress].next = list.head;
            list.nodes[list.head].prev = nodeAddress;
            list.head = nodeAddress;
        }
        
        list.size++;
        emit NodeInserted(nodeAddress, data, address(0));
        return nodeAddress;
    }
    
    /**
     * @dev Insert a new node at the end of the list
     * @param data The data to store in the new node
     * @return nodeAddress The address of the newly created node
     */
    function insertAtTail(uint256 data) public returns (address nodeAddress) {
        nodeAddress = _createNode(data);
        
        if (list.tail == address(0)) {
            // Empty list
            list.head = nodeAddress;
            list.tail = nodeAddress;
        } else {
            // Insert at tail
            list.nodes[nodeAddress].prev = list.tail;
            list.nodes[list.tail].next = nodeAddress;
            list.tail = nodeAddress;
        }
        
        list.size++;
        emit NodeInserted(nodeAddress, data, list.tail);
        return nodeAddress;
    }
    
    /**
     * @dev Insert a new node after a specified node
     * @param afterNode The address of the node to insert after
     * @param data The data to store in the new node
     * @return nodeAddress The address of the newly created node
     */
    function insertAfter(address afterNode, uint256 data) public returns (address nodeAddress) {
        require(afterNode != address(0), "LinkedList: Cannot insert after null node");
        require(list.nodes[afterNode].data != 0 || afterNode == list.head, "LinkedList: Node does not exist");
        
        nodeAddress = _createNode(data);
        
        if (afterNode == list.tail) {
            // Insert at tail
            list.nodes[nodeAddress].prev = list.tail;
            list.nodes[list.tail].next = nodeAddress;
            list.tail = nodeAddress;
        } else {
            // Insert in middle
            address nextNode = list.nodes[afterNode].next;
            list.nodes[nodeAddress].next = nextNode;
            list.nodes[nodeAddress].prev = afterNode;
            list.nodes[afterNode].next = nodeAddress;
            list.nodes[nextNode].prev = nodeAddress;
        }
        
        list.size++;
        emit NodeInserted(nodeAddress, data, afterNode);
        return nodeAddress;
    }
    
    /**
     * @dev Insert a new node before a specified node
     * @param beforeNode The address of the node to insert before
     * @param data The data to store in the new node
     * @return nodeAddress The address of the newly created node
     */
    function insertBefore(address beforeNode, uint256 data) public returns (address nodeAddress) {
        require(beforeNode != address(0), "LinkedList: Cannot insert before null node");
        require(list.nodes[beforeNode].data != 0 || beforeNode == list.head, "LinkedList: Node does not exist");
        
        nodeAddress = _createNode(data);
        
        if (beforeNode == list.head) {
            // Insert at head
            list.nodes[nodeAddress].next = list.head;
            list.nodes[list.head].prev = nodeAddress;
            list.head = nodeAddress;
        } else {
            // Insert in middle
            address prevNode = list.nodes[beforeNode].prev;
            list.nodes[nodeAddress].next = beforeNode;
            list.nodes[nodeAddress].prev = prevNode;
            list.nodes[beforeNode].prev = nodeAddress;
            list.nodes[prevNode].next = nodeAddress;
        }
        
        list.size++;
        emit NodeInserted(nodeAddress, data, list.nodes[beforeNode].prev);
        return nodeAddress;
    }
    
    /**
     * @dev Remove a node from the list
     * @param nodeAddress The address of the node to remove
     */
    function removeNode(address nodeAddress) public {
        require(nodeAddress != address(0), "LinkedList: Cannot remove null node");
        require(list.nodes[nodeAddress].data != 0 || nodeAddress == list.head, "LinkedList: Node does not exist");
        
        uint256 data = list.nodes[nodeAddress].data;
        
        if (list.size == 1) {
            // Only node in list
            list.head = address(0);
            list.tail = address(0);
        } else if (nodeAddress == list.head) {
            // Remove head
            list.head = list.nodes[nodeAddress].next;
            list.nodes[list.head].prev = address(0);
        } else if (nodeAddress == list.tail) {
            // Remove tail
            list.tail = list.nodes[nodeAddress].prev;
            list.nodes[list.tail].next = address(0);
        } else {
            // Remove from middle
            address prevNode = list.nodes[nodeAddress].prev;
            address nextNode = list.nodes[nodeAddress].next;
            list.nodes[prevNode].next = nextNode;
            list.nodes[nextNode].prev = prevNode;
        }
        
        // Clear the node
        delete list.nodes[nodeAddress];
        list.size--;
        
        emit NodeRemoved(nodeAddress, data);
    }
    
    /**
     * @dev Update the data in a node
     * @param nodeAddress The address of the node to update
     * @param newData The new data to store
     */
    function updateNode(address nodeAddress, uint256 newData) public {
        require(nodeAddress != address(0), "LinkedList: Cannot update null node");
        require(list.nodes[nodeAddress].data != 0 || nodeAddress == list.head, "LinkedList: Node does not exist");
        
        uint256 oldData = list.nodes[nodeAddress].data;
        list.nodes[nodeAddress].data = newData;
        
        emit NodeUpdated(nodeAddress, oldData, newData);
    }
    
    /**
     * @dev Get the data stored in a node
     * @param nodeAddress The address of the node
     * @return The data stored in the node
     */
    function getNodeData(address nodeAddress) public view returns (uint256) {
        require(nodeAddress != address(0), "LinkedList: Cannot get data from null node");
        require(list.nodes[nodeAddress].data != 0 || nodeAddress == list.head, "LinkedList: Node does not exist");
        return list.nodes[nodeAddress].data;
    }
    
    /**
     * @dev Get the next node in the list
     * @param nodeAddress The address of the current node
     * @return The address of the next node
     */
    function getNextNode(address nodeAddress) public view returns (address) {
        require(nodeAddress != address(0), "LinkedList: Cannot get next of null node");
        require(list.nodes[nodeAddress].data != 0 || nodeAddress == list.head, "LinkedList: Node does not exist");
        return list.nodes[nodeAddress].next;
    }
    
    /**
     * @dev Get the previous node in the list
     * @param nodeAddress The address of the current node
     * @return The address of the previous node
     */
    function getPrevNode(address nodeAddress) public view returns (address) {
        require(nodeAddress != address(0), "LinkedList: Cannot get prev of null node");
        require(list.nodes[nodeAddress].data != 0 || nodeAddress == list.head, "LinkedList: Node does not exist");
        return list.nodes[nodeAddress].prev;
    }
    
    /**
     * @dev Get the head of the list
     * @return The address of the head node
     */
    function getHead() public view returns (address) {
        return list.head;
    }
    
    /**
     * @dev Get the tail of the list
     * @return The address of the tail node
     */
    function getTail() public view returns (address) {
        return list.tail;
    }
    
    /**
     * @dev Get the size of the list
     * @return The number of nodes in the list
     */
    function getSize() public view returns (uint256) {
        return list.size;
    }
    
    /**
     * @dev Check if the list is empty
     * @return True if the list is empty, false otherwise
     */
    function isEmpty() public view returns (bool) {
        return list.size == 0;
    }
    
    /**
     * @dev Get all nodes in the list as an array
     * @return addresses Array of node addresses
     * @return data Array of node data
     */
    function getAllNodes() public view returns (address[] memory addresses, uint256[] memory data) {
        addresses = new address[](list.size);
        data = new uint256[](list.size);
        
        address current = list.head;
        uint256 index = 0;
        
        while (current != address(0) && index < list.size) {
            addresses[index] = current;
            data[index] = list.nodes[current].data;
            current = list.nodes[current].next;
            index++;
        }
        
        return (addresses, data);
    }
    
    /**
     * @dev Create a new node with the given data
     * @param data The data to store in the node
     * @return nodeAddress The address of the created node
     */
    function _createNode(uint256 data) internal returns (address nodeAddress) {
        // Use a deterministic address generation based on current state
        nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            list.size,
            data
        )))));
        
        // Ensure the address is unique (in practice, this is extremely unlikely to collide)
        while (list.nodes[nodeAddress].data != 0) {
            nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(
                nodeAddress,
                block.timestamp,
                block.prevrandao
            ))));
        }
        
        list.nodes[nodeAddress] = Node({
            data: data,
            next: address(0),
            prev: address(0)
        });
        
        return nodeAddress;
    }
}
