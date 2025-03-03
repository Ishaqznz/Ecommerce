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
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 30 },
            { header: 'User ID', key: 'userId', width: 30 },
            { header: 'Total Price', key: 'totalPrice', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Created On', key: 'createdOn', width: 25 },
        ];

        let totalAmount = 0;

        orders.forEach(order => {
            totalAmount += order.finalAmount || 0;

            worksheet.addRow({
                orderId: order._id,
                userId: order.userId || "Unknown",
                totalPrice: order.totalPrice.toFixed(2),
                finalAmount: order.finalAmount.toFixed(2),
                status: order.status,
                createdOn: order.createdOn.toISOString().split('T')[0]
            });
        });

        worksheet.addRow({});

        worksheet.addRow({
            orderId: "TOTAL", 
            finalAmount: `₹${totalAmount.toFixed(2)}` 
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Orders.xlsx');

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

        const totalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);

        const doc = new PDFDocument({ margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Orders.pdf');

        doc.pipe(res);

        doc.font('Helvetica-Bold')
            .fontSize(20)
            .text("Orders Report", { align: 'center' });

        doc.moveDown(0.5);
        doc.font('Helvetica')
            .fontSize(12)
            .text(`Date Range: ${startDate.toDateString()} - ${endDate.toDateString()}`, { align: 'center' });

        doc.moveDown(1);

        const tableTop = doc.y;
        const columnWidths = [150, 80, 80, 80, 100];
        const startX = 40;

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text("User Name", startX, tableTop, { width: columnWidths[0], align: 'center' });
        doc.text("Total Price", startX + columnWidths[0], tableTop, { width: columnWidths[1], align: 'center' });
        doc.text("Final Amount", startX + columnWidths[0] + columnWidths[1], tableTop, { width: columnWidths[2], align: 'center' });
        doc.text("Status", startX + columnWidths[0] + columnWidths[1] + columnWidths[2], tableTop, { width: columnWidths[3], align: 'center' });
        doc.text("Created On", startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], tableTop, { width: columnWidths[4], align: 'center' });

        doc.moveDown(0.5);
        doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke();

        let rowY = doc.y + 5;
        doc.font('Helvetica').fontSize(10);

        orders.forEach(order => {
            const userName = order.userId?.name || "Unknown";
            doc.text(userName, startX, rowY, { width: columnWidths[0], align: 'center' });
            doc.text(order.totalPrice.toFixed(2), startX + columnWidths[0], rowY, { width: columnWidths[1], align: 'center' });
            doc.text(order.finalAmount.toFixed(2), startX + columnWidths[0] + columnWidths[1], rowY, { width: columnWidths[2], align: 'center' });
            doc.text(order.status, startX + columnWidths[0] + columnWidths[1] + columnWidths[2], rowY, { width: columnWidths[3], align: 'center' });
            doc.text(order.createdOn.toISOString().split('T')[0], startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], rowY, { width: columnWidths[4], align: 'center' });

            rowY += 20;
        });

        // Ensure there's space for summary
            if (rowY > 700) {  
                doc.addPage();
                rowY = 40;  
            }

            // Total Amount at the bottom
            doc.moveDown(1);
            doc.font('Helvetica-Bold').fontSize(12);
            doc.text(`Total Amount: ₹${totalAmount.toFixed(2)}`, { align: 'right' });

            // Date at the bottom
            doc.moveDown(2);
            doc.fontSize(10).text(`Generated on: ${new Date().toDateString()}`, { align: 'center' });

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