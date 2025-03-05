const Order = require('../../model/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');



const filterOrder = async (req, res) => {

    try {
        let { startDate, endDate } = req.query;
        startDate = new Date(startDate);
        endDate = new Date(endDate);

        endDate.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            createdOn: { $gte: startDate, $lte: endDate }
        });

        res.json(orders);

    } catch (error) {

        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const downloadExcelReport = async (req, res) => {
  try {
      let { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
          return res.status(400).json({ error: "Missing required date parameters" });
      }

      startDate = new Date(startDate);
      endDate = new Date(endDate);
      
      if (isNaN(startDate) || isNaN(endDate)) {
          return res.status(400).json({ error: "Invalid date format" });
      }

      endDate.setHours(23, 59, 59, 999); 

      const orders = await Order.find({
          createdOn: { $gte: startDate, $lte: endDate }
      }).populate('userId', 'name');
      
      const totalOrders = orders.length;
      const totalItems = orders.reduce((sum, order) => {

          const itemCount = order.orderedItems ? 
              order.orderedItems.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) : 0;
          return sum + itemCount;
      }, 0);
      const totalBaseAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const totalDiscount = orders.reduce((sum, order) => {

          const discount = (order.totalPrice || 0) - (order.finalAmount || 0);
          return sum + (discount > 0 ? discount : 0);
      }, 0);
      const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

      const workbook = new ExcelJS.Workbook();

      const worksheet = workbook.addWorksheet('Orders', {
          properties: { tabColor: { argb: '4167B8' } }
      });

      worksheet.columns = [
          { header: 'Order ID', key: 'orderId', width: 30 },
          { header: 'User Name', key: 'userName', width: 25 },
          { header: 'Base Price', key: 'totalPrice', width: 15, style: { numFmt: '₹#,##0.00' } },
          { header: 'Final Amount', key: 'finalAmount', width: 15, style: { numFmt: '₹#,##0.00' } },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Created On', key: 'createdOn', width: 15 }
      ];

      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F2F2F2' }
      };
      worksheet.getRow(1).border = {
          bottom: { style: 'thin', color: { argb: 'CCCCCC' } }
      };

      orders.forEach(order => {
          const userName = order.userId?.name || "Unknown";
          
          worksheet.addRow({
              orderId: order.orderId || order._id,
              userName: userName,
              totalPrice: order.totalPrice || 0,
              finalAmount: order.finalAmount || 0,
              status: order.status,
              createdOn: order.createdOn.toLocaleDateString()
          });
      });

      worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: 6 }
      };

      for (let i = 2; i <= orders.length + 1; i++) {
          if (i % 2 === 0) {
              worksheet.getRow(i).fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FAFAFA' }
              };
          }
      }

      worksheet.addRow({});
      worksheet.addRow({});

      const summaryTitleRow = worksheet.addRow(['Summary']);
      summaryTitleRow.font = { bold: true, size: 14 };
      summaryTitleRow.height = 25;

      const summaryStartRow = worksheet.rowCount + 1;

      const summaryData = [
          ['Total Orders', totalOrders],
          ['Total Items', totalItems],
          ['Total Base Amount', totalBaseAmount],
          ['Total Discount', totalDiscount],
          ['Total Final Amount', totalFinalAmount]
      ];
      
      summaryData.forEach((row, index) => {
          const excelRow = worksheet.addRow(row);

          excelRow.getCell(1).font = { bold: true };

          if (typeof row[1] === 'number' && row[0].includes('Amount') || row[0].includes('Discount')) {
              excelRow.getCell(2).numFmt = '₹#,##0.00';
          }

          if (index % 2 === 0) {
              excelRow.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'F9F9F9' }
              };
          }
      });

      const summaryEndRow = worksheet.rowCount;
      
      for (let i = summaryStartRow; i <= summaryEndRow; i++) {
          const row = worksheet.getRow(i);
          
          row.getCell(1).border = {
              left: { style: 'thin' },
              right: { style: 'thin' },
              bottom: { style: 'thin' }
          };
          
          row.getCell(2).border = {
              right: { style: 'thin' },
              bottom: { style: 'thin' }
          };

          if (i === summaryStartRow) {
              row.getCell(1).border.top = { style: 'thin' };
              row.getCell(2).border.top = { style: 'thin' };
          }
      }

      worksheet.getColumn(1).width = 30;
      worksheet.getColumn(2).width = 15;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Orders_Report_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
  } catch (error) {
      console.error("Error generating Excel report:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};


const downloadPdfReport = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    startDate = new Date(startDate);
    endDate = new Date(endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate }
    }).populate('userId', 'name');
 
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => {

      const itemCount = order.orderedItems ? 
        order.orderedItems.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) : 0;
      return sum + itemCount;
    }, 0);
    const totalBaseAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => {

      const discount = (order.totalPrice || 0) - (order.finalAmount || 0);
      return sum + (discount > 0 ? discount : 0);
    }, 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Orders-Report.pdf');
    doc.pipe(res);

    const startX = 50;
    const tableWidth = doc.page.width - 100;
    const columnWidths = [
      tableWidth * 0.3,  
      tableWidth * 0.15,
      tableWidth * 0.15, 
      tableWidth * 0.15, 
      tableWidth * 0.25 
    ];

    const drawTableHeader = (y) => {
      doc.rect(startX, y, tableWidth, 25)
        .fillColor('#F3F4F6')
        .fill();

      doc.fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(10);
      
      const headerY = y + 8;
      doc.text("USER NAME", startX + 10, headerY, { width: columnWidths[0] - 10 });
      doc.text("PRICE", startX + columnWidths[0] + 10, headerY, { width: columnWidths[1] - 10, align: 'right' });
      doc.text("AMOUNT", startX + columnWidths[0] + columnWidths[1] + 10, headerY, { width: columnWidths[2] - 10, align: 'right' });
      doc.text("STATUS", startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + 10, headerY, { width: columnWidths[3] - 10, align: 'center' });
      doc.text("DATE", startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + 10, headerY, { width: columnWidths[4] - 10, align: 'center' });
      
      return y + 25;
    };

    doc.font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#2563EB')
      .text("ORDERS REPORT", { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .lineWidth(1)
      .strokeColor('#E5E7EB')
      .stroke();

    doc.moveDown(1);
    doc.font('Helvetica')
      .fontSize(12)
      .fillColor('#374151')
      .text(`Report Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, { align: 'center' });

    doc.moveDown(1.5);

    let rowY = drawTableHeader(doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563');

    const checkAndAddPage = (height) => {
      if (rowY + height > doc.page.height - 100) {
        doc.addPage();

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#2563EB')
          .text("ORDERS REPORT (Continued)", 50, 50, { align: 'center' });
        doc.moveDown(1);

        rowY = drawTableHeader(doc.y);
      }
      return rowY;
    };

    orders.forEach((order, index) => {
      rowY = checkAndAddPage(30);

      if (index % 2 === 0) {
        doc.rect(startX, rowY, tableWidth, 30)
          .fillColor('#F9FAFB')
          .fill();
      }
      
      const userName = order.userId?.name || "Unknown";
      const rowTextY = rowY + 10;
      
      doc.fillColor('#4B5563');
      doc.text(userName, startX + 10, rowTextY, { width: columnWidths[0] - 10 });
      doc.text(`₹${order.totalPrice.toFixed(2)}`, startX + columnWidths[0] + 10, rowTextY, { width: columnWidths[1] - 10, align: 'right' });
      doc.text(`₹${order.finalAmount.toFixed(2)}`, startX + columnWidths[0] + columnWidths[1] + 10, rowTextY, { width: columnWidths[2] - 10, align: 'right' });

      const statusX = startX + columnWidths[0] + columnWidths[1] + columnWidths[2];
      const statusWidth = columnWidths[3];
      const statusColors = {
        'Completed': '#10B981',  
        'Pending': '#F59E0B',   
        'Cancelled': '#EF4444', 
        'Processing': '#3B82F6' 
      };
      
      const statusColor = statusColors[order.status] || '#4B5563';
      doc.fillColor(statusColor);
      doc.text(order.status, statusX + 10, rowTextY, { width: statusWidth - 10, align: 'center' });

      doc.fillColor('#4B5563');
      doc.text(
        new Date(order.createdOn).toLocaleDateString(), 
        startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + 10, 
        rowTextY, 
        { width: columnWidths[4] - 10, align: 'center' }
      );
      
      rowY += 30;
    });

    rowY = checkAndAddPage(150); 
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827');
    doc.text("Summary", startX, rowY);
    
    rowY += 20;

    const summaryTable = [
      { label: "Total Orders", value: totalOrders },
      { label: "Total Items", value: totalItems },
      { label: "Total Base Amount", value: `₹${totalBaseAmount.toFixed(2)}` },
      { label: "Total Discount", value: `₹${totalDiscount.toFixed(2)}` },
      { label: "Total Final Amount", value: `₹${totalFinalAmount.toFixed(2)}` }
    ];

    const summaryWidth = 400;
    const labelWidth = 250;
    const valueWidth = 150;
    
    summaryTable.forEach((row, index) => {

      if (index % 2 === 0) {
        doc.rect(startX, rowY, summaryWidth, 25)
          .fillColor('#F9FAFB')
          .fill();
      }
      
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
      doc.text(row.label, startX + 10, rowY + 8, { width: labelWidth - 10 });
      
      doc.font('Helvetica').fontSize(11).fillColor('#4B5563');
      doc.text(row.value.toString(), startX + labelWidth, rowY + 8, { width: valueWidth - 10, align: 'right' });

      doc.moveTo(startX, rowY + 25)
        .lineTo(startX + summaryWidth, rowY + 25)
        .lineWidth(0.5)
        .strokeColor('#E5E7EB')
        .stroke();
      
      rowY += 25;
    });

    doc.moveTo(startX, rowY - (25 * summaryTable.length))
      .lineTo(startX + summaryWidth, rowY - (25 * summaryTable.length))
      .lineWidth(0.5)
      .strokeColor('#111827')
      .stroke();

    doc.moveTo(startX + labelWidth, rowY - (25 * summaryTable.length))
      .lineTo(startX + labelWidth, rowY)
      .stroke();
    
    doc.moveTo(startX, rowY - (25 * summaryTable.length))
      .lineTo(startX, rowY)
      .stroke();
    
    doc.moveTo(startX + summaryWidth, rowY - (25 * summaryTable.length))
      .lineTo(startX + summaryWidth, rowY)
      .stroke();

    const pageCount = doc.bufferedPageCount;
    let currentPage = 0;

    doc.fontSize(8).fillColor('#9CA3AF');
    
    const addFooter = (pageNum) => {
      doc.switchToPage(pageNum);

      doc.moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .lineWidth(0.5)
        .strokeColor('#E5E7EB')
        .stroke();

      doc.text(
        `Generated on: ${new Date().toLocaleDateString()} | Page ${pageNum + 1} of ${pageCount}`, 
        50, 
        doc.page.height - 35, 
        { align: 'center', width: doc.page.width - 100 }
      );
    };

    while (currentPage < pageCount) {
      addFooter(currentPage);
      currentPage++;
    }
    
    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
    filterOrder,
    downloadExcelReport,
    downloadPdfReport
}