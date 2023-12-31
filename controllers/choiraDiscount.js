const ChoiraDiscount = require('../models/choiraDiscount');
const User = require('../models/user');
const Transaction = require('../models/transaction');

const mongodb = require('mongodb');
const getDb = require('../util/database').getDB;
const ObjectId = mongodb.ObjectId;

const jwt = require('jsonwebtoken');


exports.createNewDiscount = (req, res, next) => {

    const discountName = req.body.discountName;
    const description = req.body.description;
    const discountType = +req.body.discountType;
    const discountPercentage = parseFloat(req.body.discountPercentage);
    const maxCapAmount = parseFloat(req.body.maxCapAmount);
    const discountDate = req.body.discountDate;
    const usersList = req.body.usersList;
    const couponCode = req.body.couponCode;

    ChoiraDiscount.findChoiraDiscountByType(discountType)
    .then(discountData=>{
        if(discountData)
        {
            return res.status(409).json({ status: false, message: "Discount for this type already exists" });
        }
        const discountObj = new ChoiraDiscount(discountName,description,discountType,discountPercentage,maxCapAmount,discountDate,usersList,
                                            couponCode);

        //saving in database
        return discountObj.save()
        .then(resultData => {
            return res.json({ status: true, message: "Discount created successfully", discount: resultData["ops"][0] });
        })
        .catch(err => console.log(err));
    })

}


exports.getAllUserDiscounts = (req,res,next)=>{

    const userId = req.params.userId;

    //get Current Date from timestamp
    let currDate = new Date();
    var yr = currDate.getUTCFullYear();
    var mth = currDate.getUTCMonth() + 1;
    if(mth.toString().length==1)
    {
        mth = "0"+mth.toString();
    }
    var dt = currDate.getUTCDate();
    if(dt.toString().length==1)
    {
        dt = "0"+dt.toString();
    }
    currDate = yr+"-"+mth+"-"+dt;
    console.log("Current Date : ",currDate);

    User.findUserByUserId(userId)
    .then(userData=>{
        if(!userData)
        {
            return res.status(404).json({ status: false, message: "No user with this ID exists" });
        }
        ChoiraDiscount.fetchAllChoiraDiscounts(0,0)
        .then(discountsData=>{
            if(discountsData.length==0)
            {
                return res.json({status:true, message:"All discounts returned for this user",discounts:[]});
            }
            else{
                const firstTimeDiscountIndex = discountsData.findIndex(i=>i.discountType==0);
                if(firstTimeDiscountIndex==-1)
                {
                    firstTimeDiscountIndex = 0;
                }
                // Transaction.fetchAllTransactionsByUserIdAndDiscountId(userId,discountsData[firstTimeDiscountIndex]._id.toString())
                Transaction.fetchAllTransactionsByUserId(userId)
                .then(transactionsData=>{
                    // console.log("Transactions : "+transactionsData.length);
                    if(transactionsData.length==0)
                    {
                        //Then user is eligible for FIRST TIME Discount (and not recurring)
                        discountsData = discountsData.filter(i=>i.discountType!=1);
                    }
                    else{
                        //Then user is eligible for RECURRING Discount (and not first-time)
                        discountsData = discountsData.filter(i=>i.discountType!=0);
                    }

                    //If event date is not today, do not send this DISCOUNT in list
                    let eventDiscountData = discountsData.filter(i=>i.discountType==2);
                    // console.log(eventDiscountData);
                    if(eventDiscountData.length!=0)
                    {
                        // console.log(eventDiscountData);
                        let eventDate = new Date(eventDiscountData[0].discountDate);
                        var yr = eventDate.getUTCFullYear();
                        var mth = eventDate.getUTCMonth() + 1;
                        if(mth.toString().length==1)
                        {
                            mth = "0"+mth.toString();
                        }
                        var dt = eventDate.getUTCDate();
                        if(dt.toString().length==1)
                        {
                            dt = "0"+dt.toString();
                        }
                        eventDate = yr+"-"+mth+"-"+dt;
                        console.log("Event Date : ",eventDate);
                        if(currDate!=eventDate)
                        {
                            //remove this discount from list
                            discountsData = discountsData.filter(i=>i.discountType!=2);
                        }
                    }
                    
                    //If user is not in special list, do not send this DISCOUNT in list
                    let specialDiscountData = discountsData.filter(i=>i.discountType==3);
                    // console.log(specialDiscountData);
                    if(specialDiscountData.length!=0)
                    {
                        const index = specialDiscountData[0].usersList.findIndex(i=>i.toString()==userId.toString());
                        if(index==-1)
                        {
                            //remove this discount from list
                            discountsData = discountsData.filter(i=>i.discountType!=3);
                        }
                    }

                    return res.json({status:true, message:"All discounts returned for this user",discounts:discountsData});
                })
            }
        })
    })

}


exports.getAllDiscounts = (req,res,next)=>{

    ChoiraDiscount.fetchAllChoiraDiscounts(0,0)
    .then(discountsData=>{
        return res.json({status:true, message:"All discounts returned",discounts:discountsData});
    })

}


exports.getParticularDiscountDetails = (req,res,next)=>{

    const discountId = req.params.discountId;

    ChoiraDiscount.findChoiraDiscountById(discountId)
    .then(discountData=>{
        if(!discountData)
        {
            return res.status(404).json({status:false, message:"No Discount with this ID exists"});
        }
        return res.json({status:true, message:"Discount exists", discount:discountData});
    })

}


exports.editDiscountDetails = (req,res,next)=>{

    const discountId = req.params.discountId;

    const discountName = req.body.discountName;
    const description = req.body.description;
    const discountPercentage = parseFloat(req.body.discountPercentage);
    const maxCapAmount = parseFloat(req.body.maxCapAmount);
    const discountDate = req.body.discountDate;
    const usersList = req.body.usersList;
    const couponCode = req.body.couponCode;

    ChoiraDiscount.findChoiraDiscountById(discountId)
    .then(discountData=>{
        if(!discountData)
        {
            return res.status(404).json({status:false, message:"No Discount with this ID exists"});
        }
        discountData.discountName = discountName;
        discountData.description = description;
        discountData.discountPercentage = discountPercentage;
        discountData.maxCapAmount = maxCapAmount;
        discountData.discountDate = discountDate;
        discountData.usersList = usersList;
        discountData.couponCode = couponCode;

        const db = getDb();
        var o_id = new ObjectId(discountId);

        db.collection('choiraDiscounts').updateOne({_id:o_id},{$set:discountData})
        .then(resultData=>{
            return res.json({ status:true, message:'Discount details updated successfully', discount:discountData});
        });
    })

}
