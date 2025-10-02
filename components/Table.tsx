import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, Linking, Button, Dimensions } from 'react-native';


interface StudentItem {
  id: string | number;
  customerName: string;
  phone: string;
  hostel: string;
  size: string;
  price: string;
}

const StudentModal = ({ student, onClose }) => (
  <View style={styles.modalContent}>
    <Text>Name: {student?.customerName}</Text>
    <Text>Phone: {student?.Phone}</Text>
    <Button title="Call" onPress={() => Linking.openURL(`tel:${student?.Phone}`)} />
    <Button title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${student?.Phone}`)} />
    <Button title="Close" onPress={onClose} />
  </View>
);

const TableHeader = () => (
  <View style={styles.headerContainer}>
    {['#', 'Name', 'Hostel', 'Size', 'Price'].map(header => (
      <Text key={header} style={styles.headerText}>{header}</Text>
    ))}
  </View>
);

const Table = ({ onSelectCountChange }) => {

  const tableData = [
  {
    id: '011',
    customerName: 'Nana Ama Amankwah',
    phone: '055 414 4611',
    hostel: 'Hall 7',
    size: 'Medium',
    price: 'GHS 65.00',
    status: 'pending' // You might want to add status for different visual states
  },
  {
    id: '012',
    customerName: 'Kwame Mensah',
    phone: '020 123 4567',
    hostel: 'Hall 3',
    size: 'Large',
    price: 'GHS 85.00',
    status: 'completed'
  },
  {
    id: '013',
    customerName: 'Ama Serwaa',
    phone: '054 987 6543',
    hostel: 'Hall 5',
    size: 'Small',
    price: 'GHS 45.00',
    status: 'pending'
  },
  {
    id: '014',
    customerName: 'Kofi Owusu',
    phone: '027 555 1234',
    hostel: 'Hall 2',
    size: 'Medium',
    price: 'GHS 65.00',
    status: 'in-progress'
  },
  {
    id: '015',
    customerName: 'Abena Pokuaa',
    phone: '024 777 8888',
    hostel: 'Hall 8',
    size: 'Large',
    price: 'GHS 85.00',
    status: 'pending'
  },
  {
    id: '016',
    customerName: 'Yaw Boateng',
    phone: '050 222 3333',
    hostel: 'Hall 4',
    size: 'Small',
    price: 'GHS 45.00',
    status: 'completed'
  },
  {
    id: '017',
    customerName: 'Akua Nyarko',
    phone: '055 666 9999',
    hostel: 'Hall 6',
    size: 'Medium',
    price: 'GHS 65.00',
    status: 'pending'
  },
  {
    id: '018',
    customerName: 'Kwabena Osei',
    phone: '020 444 5555',
    hostel: 'Hall 1',
    size: 'Large',
    price: 'GHS 85.00',
    status: 'in-progress'
  },
  {
    id: '019',
    customerName: 'Adwoa Safo',
    phone: '054 111 2222',
    hostel: 'Hall 9',
    size: 'Small',
    price: 'GHS 45.00',
    status: 'completed'
  },
  {
    id: '020',
    customerName: 'Benedicta Appiah',
    phone: '027 888 9999',
    hostel: 'Hall 7',
    size: 'Medium',
    price: 'GHS 65.00',
    status: 'pending'
  }
];

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleStudentPress = useCallback((student: React.SetStateAction<null>) => {
    setSelectedStudent(student);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedStudent(null);
  }, []);


  const renderStudentItem = useCallback(({ item }: { item: StudentItem }) => (
    <TouchableOpacity onPress={() => handleStudentPress(item)}>
      <View style={styles.studentItemContainer}>
        <View style={styles.studentInfoRow}>
          <View style={styles.studentLeftSection}>
            <Text style={styles.idText}>#{item.id}</Text>
            <View>
              <Text style={styles.nameText}>{item.customerName}</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.phoneText}>{item.phone}</Text>
                <View style={styles.separator} />
                <Text style={styles.hostelText}>{item.hostel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.studentRightSection}>
            <Text style={styles.sizeText}>{item.size}</Text>
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), [handleStudentPress]);



  return (

    <>
       <FlatList
          data={tableData}
          renderItem={renderStudentItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false} // ✅ Disable FlatList scrolling
          nestedScrollEnabled={true} // ✅ Allow nested scrolling
        />

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <StudentModal student={selectedStudent} onClose={handleCloseModal} />
        </View>
      </Modal>
    </>

  );
};

const styles = StyleSheet.create({

  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  listContainer: {
    gap: 12,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    // backgroundColor: 'red'
  },
  studentItemContainer: {
    gap: 16,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical : 12
  },
  studentLeftSection: {
    flexDirection: 'row',
    gap: 12,
    flex: 1
  },
  studentRightSection: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  idText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)'
  },
  nameText: {
    fontSize: 14,
    color: 'rgba(0,0,0,1)',
    fontWeight: '500'
  },
  contactInfo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  phoneText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)'
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  hostelText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)'
  },
  sizeText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.5)',
    padding: 4,
    backgroundColor: '#fafafa',
    borderRadius: 8
  },
  priceText: {
    fontSize: 14,
    color: 'rgba(0,0,0,1)',
    fontWeight: '600'
  },
  dashedSeparator: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.2)',
    marginLeft: 14
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  }
});

export default Table;